import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

export interface Pulse { unreadNotifications: number; unreadConversations: number; newestNotification: { id: string; type: string; read: boolean } | null }

/** Badge counts (same /pulse endpoint the web app polls). Polls only while signed in and the app is in the foreground. */
export function usePulse() {
  const { status } = useAuth();
  return useQuery({ queryKey: ['pulse'], queryFn: () => api<Pulse>('/pulse'), enabled: status === 'authed', refetchInterval: 20_000, staleTime: 10_000 });
}
