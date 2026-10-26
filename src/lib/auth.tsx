import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, onSessionEnded, onSessionRefreshed, refreshSession, startSession, type SessionPayload } from './api';
import { tokenStore } from './token-store';
import type { Me } from './types';

type Status = 'loading' | 'authed' | 'anon';
interface AuthCtx {
  status: Status; user: Me | null;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading'); const [user, setUser] = useState<Me | null>(null);
  const qc = useQueryClient();

  const signedIn = useCallback(async (s: SessionPayload) => { await startSession(s); setUser(s.me as Me); setStatus('authed'); qc.clear(); }, [qc]);

  // Restore the session from the keychain on launch.
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await refreshSession();
      if (!alive) return;
      if (s) { setUser(s.me as Me); setStatus('authed'); return; }
      // Offline with a stored token: let the user in read-only-ish; requests retry the refresh when back online.
      setStatus((await tokenStore.get()) ? 'authed' : 'anon');
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => onSessionRefreshed((s) => { setUser(s.me as Me); setStatus('authed'); }), []);

  // Server stopped accepting the session (expired, password changed elsewhere, suspended).
  useEffect(() => onSessionEnded(() => { setUser(null); setStatus('anon'); qc.clear(); router.replace('/welcome'); }), [qc]);

  const value = useMemo<AuthCtx>(() => ({
    status, user,
    login: async (email, password) => signedIn(await api<SessionPayload>('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (displayName, email, password) => signedIn(await api<SessionPayload>('/auth/register', { method: 'POST', body: { displayName, email, password } })),
    logout: async () => {
      const refreshToken = await tokenStore.get();
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
      await clearSession(); setUser(null); setStatus('anon'); qc.clear();
    },
    reload: async () => { setUser(await api<Me>('/users/me')); },
  }), [status, user, signedIn, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx); if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

/** For actions that need an account (offer, save, chat): returns false and opens sign-in when signed out. */
export function useRequireAccount() {
  const { status } = useAuth();
  return useCallback(() => { if (status === 'authed') return true; router.push('/login'); return false; }, [status]);
}
