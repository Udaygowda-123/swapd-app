import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from './api';

/**
 * TanStack Query wired to the phone (the web gets this from the browser for free):
 * - focus = app in the foreground → refetchOnWindowFocus works, and refetchInterval polling pauses in the background
 * - online = NetInfo → paused (not failed) requests while offline, auto-resume on reconnect
 */
export function setupQueryForMobile() {
  if (Platform.OS !== 'web') {
    focusManager.setEventListener((setFocused) => { const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active')); return () => sub.remove(); });
  }
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)));
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, gcTime: 10 * 60_000,
        refetchOnWindowFocus: true, refetchIntervalInBackground: false,
        // 4xx are answers, not glitches — don't retry them (same rule as the web app).
        retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      },
    },
  });
}
