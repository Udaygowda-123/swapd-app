import type { Tone } from '@/components/ui';
import type { OfferStatus } from './shared';
import type { ListingBrief, Offer } from './types';

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'butter' }, COUNTERED: { label: 'Countered', tone: 'lilac' }, ACCEPTED: { label: 'Accepted', tone: 'mint' },
  REJECTED: { label: 'Declined', tone: 'neutral' }, WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' }, EXPIRED: { label: 'Expired', tone: 'neutral' }, CANCELLED: { label: 'Closed', tone: 'neutral' },
};

export const isOpen = (o: Pick<Offer, 'status'>) => o.status === 'PENDING' || o.status === 'COUNTERED';

/** Latest terms from the viewer's side: what I give, what I get, and whether I'm the one adding cash. */
export function mySide(o: Offer, me?: string): { give: ListingBrief[]; get: ListingBrief[]; cash: number; cashFromMe: boolean; other: Offer['sender'] } {
  const r = o.revisions[o.revisions.length - 1]; const iAmSender = o.sender.id === me;
  return { give: iAmSender ? r.offered : r.requested, get: iAmSender ? r.requested : r.offered, cash: r.cashAmount, cashFromMe: r.cashPayerId === me, other: iAmSender ? o.recipient : o.sender };
}

// Grouped by what needs attention; derived only from the server's offer state.
export const GROUPS = [{ id: 'yours', label: 'Needs your response' }, { id: 'theirs', label: 'Waiting for them' }, { id: 'deals', label: 'Deals' }, { id: 'closed', label: 'Closed' }] as const;
export function groupOf(o: Offer): (typeof GROUPS)[number]['id'] {
  if (o.deal) return 'deals';
  if (isOpen(o)) return o.yourTurn ? 'yours' : 'theirs';
  return 'closed';
}
