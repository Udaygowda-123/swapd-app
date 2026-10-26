import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Handshake, MessageCircle, Repeat, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProposalStrip } from '@/components/proposal-strip';
import { BackHeader, Badge, Button, Card, EmptyState, ErrorState, Loading, T } from '@/components/ui';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { useToast } from '@/lib/toast';
import { formatINR, timeAgo, timeLeft } from '@/lib/format';
import { isOpen, mySide, OFFER_STATUS } from '@/lib/offers';
import type { Offer } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

type Action = 'accept' | 'reject' | 'withdraw';

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { user } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['offer', id], queryFn: () => api<Offer>(`/offers/${id}`), refetchInterval: 20_000 });
  const [busy, setBusy] = useState<Action | null>(null); const idem = useRef(newIdempotencyKey());
  const me = user?.id;

  if (q.isPending) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader label="Offers" fallback="/offers" /><Loading /></View>;
  if (q.error instanceof ApiError && q.error.status === 404) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader label="Offers" fallback="/offers" /><EmptyState icon={<X size={28} color={colors.coralInk} />} title="Offer not found" body="It may not exist, or it isn't yours to see." /></View>;
  if (q.isError) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader label="Offers" fallback="/offers" /><ErrorState onRetry={() => q.refetch()} /></View>;

  const o = q.data; const side = mySide(o, me); const latest = o.revisions[o.revisions.length - 1]; const st = OFFER_STATUS[o.status];
  const nameOf = (uid: string) => (uid === me ? 'You' : uid === o.sender.id ? o.sender.displayName : o.recipient.displayName);

  async function run(a: Action) {
    const copy = {
      accept: ['Accept these exact terms?', `You're accepting version ${latest.number}. This creates a deal and reserves the items.`, 'Accept & create deal'],
      reject: ['Decline this offer?', `${side.other.displayName} will be notified. This closes the offer.`, 'Decline offer'],
      withdraw: ['Withdraw your offer?', `${side.other.displayName} will be notified. This closes the offer.`, 'Withdraw'],
    }[a];
    if (!(await confirm(copy[0], copy[1], copy[2], { destructive: a !== 'accept' }))) return;
    setBusy(a); idem.current = newIdempotencyKey();
    try {
      const body = a === 'accept' ? { expectedVersion: o.version, revisionNumber: latest.number } : { expectedVersion: o.version };
      const next = await api<Offer>(`/offers/${o.id}/${a}`, { method: 'POST', idempotencyKey: idem.current, body });
      qc.setQueryData(['offer', id], next); qc.invalidateQueries({ queryKey: ['offers'] }); qc.invalidateQueries({ queryKey: ['pulse'] });
      toast.success({ accept: 'Offer accepted — a deal has been created', reject: 'Offer declined', withdraw: 'Offer withdrawn' }[a]);
      if (a === 'accept' && next.deal) router.push(`/deal/${next.deal.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.code === 'STALE_OFFER' ? 'This offer just changed — review the latest version.' : e.message) : 'Could not complete that. Check your connection.');
      q.refetch();
    } finally { setBusy(null); }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top }}><BackHeader label="Offers" fallback="/offers" /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 18, paddingBottom: 40 + insets.bottom }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.ink} />}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}><Badge label={st.label} tone={st.tone} />{o.yourTurn ? <Badge label="Your turn" tone="cobalt" /> : null}</View>
          <T v="title">{o.targetListing.title}</T>
          <T v="small" color={colors.muted}>{o.sender.id === me ? `You offered to ${side.other.displayName}` : `${side.other.displayName} made you an offer`} · {isOpen(o) ? timeLeft(o.expiresAt) : `updated ${timeAgo(o.updatedAt)}`}</T>
        </View>

        <ProposalStrip give={side.give} get={side.get} cash={side.cash} cashFromYou={side.cashFromMe} otherName={side.other.displayName} />
        {latest.message ? <Card><T v="label" color={colors.muted}>{nameOf(latest.authorId)} wrote</T><T style={{ marginTop: 6 }}>“{latest.message}”</T></Card> : null}

        {isOpen(o) ? (
          o.yourTurn ? (
            <View style={{ gap: 10 }}>
              <Button title="Accept these terms" size="lg" icon={<Check size={18} color={colors.ink} />} loading={busy === 'accept'} disabled={!!busy} onPress={() => run('accept')} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Counter" variant="soft" style={{ flex: 1 }} icon={<Repeat size={16} color={colors.ink} />} disabled={!!busy} onPress={() => router.push({ pathname: '/swap/[id]', params: { id: o.targetListing.id, counter: o.id } })} />
                <Button title="Decline" variant="outline" style={{ flex: 1 }} loading={busy === 'reject'} disabled={!!busy} onPress={() => run('reject')} />
              </View>
            </View>
          ) : (
            <Card style={{ gap: 12 }}>
              <T>Waiting for <T v="strong">{nameOf(o.awaitingUserId ?? '')}</T> to respond.</T>
              <Button title="Withdraw offer" variant="outline" loading={busy === 'withdraw'} disabled={!!busy} onPress={() => run('withdraw')} />
            </Card>
          )
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {o.conversationId ? <Button title="Open chat" variant="outline" style={{ flex: 1 }} icon={<MessageCircle size={16} color={colors.ink} />} onPress={() => router.push(`/chat/${o.conversationId}`)} /> : null}
          {o.deal ? <Button title="View deal" variant="ink" style={{ flex: 1 }} icon={<Handshake size={16} color={colors.paper} />} onPress={() => router.push(`/deal/${o.deal!.id}`)} /> : null}
        </View>

        <View style={{ gap: 10 }}>
          <T v="heading">History</T>
          {[...o.revisions].reverse().map((r) => {
            const youGive = o.sender.id === me ? r.offered : r.requested; const youGet = o.sender.id === me ? r.requested : r.offered;
            return (
              <View key={r.id} style={s.rev}>
                <View style={[s.pin, { backgroundColor: r.id === o.acceptedRevisionId ? colors.mintInk : r.number === latest.number ? colors.coral : colors.line }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="strong" style={{ fontSize: 14 }}>Version {r.number} · {nameOf(r.authorId)} · {timeAgo(r.createdAt)}{r.id === o.acceptedRevisionId ? ' · accepted' : ''}</T>
                  <T v="small" color={colors.muted}>You give: {youGive.map((i) => i.title).join(', ') || 'no items'}</T>
                  <T v="small" color={colors.muted}>You get: {youGet.map((i) => i.title).join(', ') || 'no items'}</T>
                  {r.cashAmount > 0 ? <T v="small" color={colors.muted}>Cash: {formatINR(r.cashAmount)} from {nameOf(r.cashPayerId ?? '')}</T> : null}
                </View>
              </View>
            );
          })}
        </View>
        <T v="small" color={colors.muted} style={{ fontFamily: fonts.body }}>Cash amounts are negotiated proposals. SWAPD does not move money, hold funds, or guarantee item values.</T>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  rev: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 },
  pin: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
