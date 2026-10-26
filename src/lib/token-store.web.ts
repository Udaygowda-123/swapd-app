// Web preview only (SecureStore has no web implementation). Native builds use token-store.ts.
const KEY = 'swapd.refreshToken';

export const tokenStore = {
  get: async () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: async (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } },
  clear: async () => { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } },
};
