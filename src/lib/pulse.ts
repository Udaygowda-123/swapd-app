import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { useToast } from './toast';

export interface Pulse { unreadNotifications: number; unreadConversations: number; newestNotification: { id: string; type: string; read: boolean } | null }

/** One tiny request feeds the tab badges and toast detection (same /pulse endpoint as the web). Pauses in the background. */
export function usePulse() {
  const { status } = useAuth();
  return useQuery({ queryKey: ['pulse'], queryFn: () => api<Pulse>('/pulse'), enabled: status === 'authed', refetchInterval: 15_000, staleTime: 5_000 });
}

const TEXT: Record<string, string> = {
  OFFER_RECEIVED: 'You have a new offer', OFFER_COUNTERED: 'You received a counteroffer', OFFER_ACCEPTED: 'Your offer was accepted 🎉',
  OFFER_REJECTED: 'An offer was declined', OFFER_WITHDRAWN: 'An offer was withdrawn', OFFER_CANCELLED: 'An offer was cancelled (item unavailable)', OFFER_EXPIRED: 'An offer expired',
  DEAL_UPDATED: 'A deal was updated', REVIEW_RECEIVED: 'You received a review', MODERATION: 'Moderation update',
};

/** "Live" updates without sockets: when the pulse changes, toast it and refresh only the data that could have changed. */
export function PulseEffects() {
  const { data } = usePulse(); const qc = useQueryClient(); const toast = useToast();
  const prev = useRef<{ nid?: string; convs?: number }>({});
  useEffect(() => {
    if (!data) return;
    const p = prev.current; const n = data.newestNotification;
    if (p.nid !== undefined && n && n.id !== p.nid && !n.read) {
      if (n.type !== 'MESSAGE' && TEXT[n.type]) toast.info(TEXT[n.type]);
      for (const k of ['offers', 'offer', 'deals', 'deal', 'notifications']) qc.invalidateQueries({ queryKey: [k] });
    }
    if (p.convs !== undefined && data.unreadConversations !== p.convs) qc.invalidateQueries({ queryKey: ['conversations'] });
    prev.current = { nid: n?.id ?? '', convs: data.unreadConversations };
  }, [data, qc, toast]);
  return null;
}
