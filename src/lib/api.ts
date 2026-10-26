import { tokenStore } from './token-store';

/** The SWAPD web app's API. Override with EXPO_PUBLIC_API_URL (e.g. your laptop's LAN address while developing). */
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? 'https://barter-web-wheat.vercel.app').replace(/\/$/, '');
const API = `${API_ORIGIN}/api/v1`;

/** Image URLs from the API can be relative (demo photos, locally stored uploads); make them loadable on the phone. */
export const absUrl = (u: string | null | undefined) => (!u ? null : /^https?:\/\//.test(u) ? u : `${API_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path: string; message: string }[]) { super(message); }
  fieldErrors(): Record<string, string> { return Object.fromEntries((this.details ?? []).map((d) => [d.path, d.message])); }
}

// Access token: memory only. Refresh token: device keychain/keystore (see token-store), rotated on every refresh.
let accessToken: string | null = null;
let refreshing: Promise<SessionPayload | null> | null = null;
const endListeners = new Set<() => void>();
const refreshListeners = new Set<(s: SessionPayload) => void>();

export interface SessionPayload { accessToken: string; refreshToken: string; me: unknown }
export const onSessionEnded = (fn: () => void) => { endListeners.add(fn); return () => { endListeners.delete(fn); }; };
export const onSessionRefreshed = (fn: (s: SessionPayload) => void) => { refreshListeners.add(fn); return () => { refreshListeners.delete(fn); }; };

export async function startSession(s: SessionPayload) { accessToken = s.accessToken; await tokenStore.set(s.refreshToken); }
export async function clearSession() { accessToken = null; await tokenStore.clear(); }
const endSession = async () => { await clearSession(); endListeners.forEach((l) => l()); };

/** Single-flight refresh: concurrent 401s share one rotation so we never spend the same refresh token twice. */
export function refreshSession(): Promise<SessionPayload | null> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await tokenStore.get();
      if (!refreshToken) return null;
      const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (!res.ok) { if (res.status === 401 || res.status === 403) await clearSession(); return null; }
      const data = (await res.json()) as SessionPayload;
      await startSession(data); refreshListeners.forEach((l) => l(data));
      return data;
    } catch { return null; } // offline: keep the stored token and try again later
    finally { refreshing = null; }
  })();
  return refreshing;
}

interface Opts { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; idempotencyKey?: string; retry?: boolean; signal?: AbortSignal }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { body, idempotencyKey, retry = true, method = 'GET', signal } = opts;
  const isForm = body instanceof FormData;
  // Launched offline with a saved login: get an access token as soon as the network is back.
  if (!accessToken && retry && !path.startsWith('/auth/') && (await tokenStore.get())) await refreshSession();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method, signal,
      credentials: 'omit', // the session lives in the keychain, not in cookies
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'OFFLINE', "Can't reach SWAPD. Check your connection and try again.");
  }
  if (res.status === 401 && retry && accessToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
    await endSession();
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? 'Something went wrong', data.details);
  return data as T;
}

export const newIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
