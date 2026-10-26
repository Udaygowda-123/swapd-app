import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertOctagon, CheckCircle2, Circle, MessageCircle, PartyPopper, Star } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader, Badge, Button, Card, ErrorState, Field, Loading, T, type Tone } from '@/components/ui';
import { absUrl, api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm, notify } from '@/lib/confirm';
import { formatINR } from '@/lib/format';
import type { DealStatus, ExchangeMethod } from '@/lib/shared';
import type { Deal, ListingBrief } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

const DEAL_TONE: Record<DealStatus, Tone> = { ACTIVE: 'butter', COMPLETED: 'mint', CANCELLED: 'neutral', DISPUTED: 'danger' };

export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { user } = useAuth(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['deal', id], queryFn: () => api<Deal>(`/deals/${id}`), refetchInterval: 30_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [method, setMethod] = useState<ExchangeMethod>('LOCAL_HANDOVER'); const [notes, setNotes] = useState(''); const [editPlan, setEditPlan] = useState(false);
  const [reasonFor, setReasonFor] = useState<'cancel' | 'dispute' | null>(null); const [reason, setReason] = useState('');
  const [rating, setRating] = useState(0); const [review, setReview] = useState('');

  if (q.isPending) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader label="Deals" fallback="/deals" /><Loading /></View>;
  if (q.isError) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader label="Deals" fallback="/deals" /><ErrorState onRetry={() => q.refetch()} /></View>;
  const d = q.data; const t = d.terms; const live = d.status === 'ACTIVE' || d.status === 'DISPUTED';
  const cashFrom = t.cashPayerId === user?.id ? 'you' : d.counterpart.displayName;

  async function act(path: string, body?: unknown, ok?: string) {
    setBusy(path);
    try {
      const next = await api<unknown>(`/deals/${id}/${path}`, { method: 'POST', body: body ?? {} });
      // Most actions return the updated deal; posting a review returns the review, so refetch then.
      if (next && typeof next === 'object' && 'terms' in next) qc.setQueryData(['deal', id], next as Deal); else q.refetch();
      qc.invalidateQueries({ queryKey: ['deals'] }); qc.invalidateQueries({ queryKey: ['offers'] });
      setEditPlan(false); setReasonFor(null); setReason('');
      if (ok) notify(ok);
    } catch (e) { notify('Could not update the deal', e instanceof ApiError ? e.message : 'Check your connection and try again.'); }
    finally { setBusy(null); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}><BackHeader label="Deals" fallback="/deals" /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 40 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Badge label={d.status.toLowerCase()} tone={DEAL_TONE[d.status]} />
          <T v="title">Swap with {d.counterpart.displayName}</T>
        </View>

        {d.status === 'COMPLETED' ? <View style={[s.banner, { backgroundColor: colors.mint }]}><PartyPopper size={18} color={colors.mintInk} /><T v="strong" color={colors.mintInk} style={{ flex: 1 }}>Swap complete — enjoy your new thing!</T></View> : null}
        {d.status === 'DISPUTED' ? <View style={[s.banner, { backgroundColor: colors.dangerSoft }]}><AlertOctagon size={18} color={colors.danger} /><T v="small" color={colors.danger} style={{ flex: 1 }}>Dispute open. {d.dispute?.byMe ? 'You reported' : 'The other person reported'}: “{d.dispute?.reason}”. Moderators will review it.</T></View> : null}
        {d.status === 'CANCELLED' ? <Card><T v="small" color={colors.muted}>Cancelled {d.cancellation?.byMe ? 'by you' : 'by the other person'}: “{d.cancellation?.reason}”. The items are available again.</T></Card> : null}

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="heading">Agreed terms <T v="small" color={colors.muted}>· version {t.revisionNumber}</T></T>
            {d.conversationId ? <Button title="Chat" size="sm" variant="soft" icon={<MessageCircle size={14} color={colors.ink} />} onPress={() => router.push(`/chat/${d.conversationId}`)} /> : null}
          </View>
          <Items label="You give" items={t.giving} />
          <Items label="You get" items={t.receiving} />
          {t.cashAmount > 0 ? <View style={[s.banner, { backgroundColor: colors.mint }]}><T v="strong" color={colors.mintInk}>{formatINR(t.cashAmount)} agreed, from {cashFrom}</T></View> : null}
          <T v="small" color={colors.muted}>Cash is a negotiated proposal between you two. SWAPD does not move money or hold funds.</T>
        </Card>

        {live ? (
          <>
            <Card style={{ gap: 10 }}>
              <T v="heading">1 · Handover plan</T>
              {d.handover.method && !editPlan ? (
                <>
                  <T><T v="strong">{d.handover.method === 'SHIPPING' ? 'Shipping' : 'Local meet-up'}</T>{d.handover.notes ? ` — ${d.handover.notes}` : ''}</T>
                  <Step done={d.handover.confirmedByMe} label="You agreed to this plan" />
                  <Step done={d.handover.confirmedByOther} label={`${d.counterpart.displayName} agreed`} />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {!d.handover.confirmedByMe ? <Button title="I agree to this plan" size="sm" loading={busy === 'confirm-handover'} onPress={() => act('confirm-handover')} /> : null}
                    <Button title="Change plan" size="sm" variant="outline" onPress={() => { setMethod(d.handover.method!); setNotes(d.handover.notes ?? ''); setEditPlan(true); }} />
                  </View>
                </>
              ) : (
                <>
                  <View style={s.segment}>
                    {(['LOCAL_HANDOVER', 'SHIPPING'] as const).map((m) => (
                      <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: method === m }} onPress={() => setMethod(m)} style={[s.seg, method === m && s.segOn]}><T v="strong" style={{ fontSize: 14 }}>{m === 'SHIPPING' ? 'Shipping' : 'Meet-up'}</T></Pressable>
                    ))}
                  </View>
                  <Field label="Details (optional)" multiline maxLength={500} value={notes} onChangeText={setNotes} placeholder={method === 'SHIPPING' ? 'Courier, who ships first…' : 'A public place and a time that works…'} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Save plan" size="sm" loading={busy === 'handover'} onPress={() => act('handover', { method, notes: notes.trim() || undefined })} />
                    {editPlan ? <Button title="Cancel" size="sm" variant="ghost" onPress={() => setEditPlan(false)} /> : null}
                  </View>
                </>
              )}
            </Card>

            <Card style={{ gap: 10 }}>
              <T v="heading">2 · Confirm completion</T>
              <T v="small" color={colors.muted}>After you&apos;ve handed over your item and received yours, confirm below. The swap is only complete when both of you confirm.</T>
              <Step done={d.completion.confirmedByMe} label="You confirmed" />
              <Step done={d.completion.confirmedByOther} label={`${d.counterpart.displayName} confirmed`} />
              {!d.completion.confirmedByMe ? (
                <Button title={d.handover.method ? 'Confirm swap complete' : 'Set a handover plan first'} disabled={!d.handover.method} loading={busy === 'confirm-completion'}
                  onPress={async () => { if (await confirm('Confirm the swap is complete?', "Only confirm once you've received your item and you're happy with it. This can't be undone.", 'Yes, complete')) act('confirm-completion'); }} />
              ) : !d.completion.confirmedByOther ? <View style={[s.banner, { backgroundColor: colors.butter }]}><T v="small" color={colors.butterInk}>Waiting for {d.counterpart.displayName} to confirm.</T></View> : null}
            </Card>

            {reasonFor ? (
              <Card style={{ gap: 10 }}>
                <T v="heading">{reasonFor === 'cancel' ? 'Cancel this deal?' : 'Report a problem'}</T>
                <T v="small" color={colors.muted}>{reasonFor === 'cancel' ? 'The items become available again and the other person is told why.' : 'Moderators will review the deal. Describe what went wrong (at least 10 characters).'}</T>
                <Field label="Reason" multiline value={reason} onChangeText={setReason} maxLength={reasonFor === 'cancel' ? 300 : 500} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title={reasonFor === 'cancel' ? 'Cancel deal' : 'Open dispute'} variant="danger" size="sm" loading={busy === reasonFor} disabled={reason.trim().length < (reasonFor === 'cancel' ? 3 : 10)} onPress={() => act(reasonFor, { reason: reason.trim() })} />
                  <Button title="Never mind" variant="ghost" size="sm" onPress={() => setReasonFor(null)} />
                </View>
              </Card>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button title="Cancel deal" variant="outline" size="sm" onPress={() => { setReason(''); setReasonFor('cancel'); }} />
                {d.status === 'ACTIVE' ? <Button title="Something's wrong" variant="ghost" size="sm" onPress={() => { setReason(''); setReasonFor('dispute'); }} /> : null}
              </View>
            )}
          </>
        ) : null}

        {d.status === 'COMPLETED' ? (
          <Card style={{ gap: 10 }}>
            <T v="heading">Reviews</T>
            {d.reviews.mine ? <T>You rated {d.counterpart.displayName} <T v="strong">{d.reviews.mine.rating}/5</T>{d.reviews.mine.body ? ` — “${d.reviews.mine.body}”` : ''}</T> : d.reviews.canReview ? (
              <>
                <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="radiogroup">
                  {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} accessibilityState={{ checked: rating === n }} onPress={() => setRating(n)} hitSlop={4}><Star size={30} color={n <= rating ? colors.coral : colors.line} fill={n <= rating ? colors.coral : 'transparent'} /></Pressable>)}
                </View>
                <Field label="How did it go? (optional)" multiline maxLength={500} value={review} onChangeText={setReview} />
                <Button title="Post review" disabled={!rating} loading={busy === 'reviews'} onPress={() => act('reviews', { rating, body: review.trim() || undefined }, 'Thanks for the review!')} />
              </>
            ) : null}
            {d.reviews.theirs ? <T style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>{d.counterpart.displayName} rated you <T v="strong">{d.reviews.theirs.rating}/5</T>{d.reviews.theirs.body ? ` — “${d.reviews.theirs.body}”` : ''}</T> : null}
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Items({ label, items }: { label: string; items: ListingBrief[] }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="label" color={colors.muted}>{label}</T>
      {items.length ? items.map((i) => (
        <Pressable key={i.id} accessibilityRole="link" onPress={() => router.push(`/listing/${i.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={absUrl(i.thumbUrl)} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFEBE4' }} contentFit="cover" />
          <T v="strong" numberOfLines={1} style={{ flex: 1 }}>{i.title}</T>
          <T v="small" color={colors.muted}>{i.estimatedValue != null ? `~${formatINR(i.estimatedValue)}` : ''}</T>
        </Pressable>
      )) : <T v="small" color={colors.muted}>No items</T>}
    </View>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{done ? <CheckCircle2 size={18} color={colors.mintInk} /> : <Circle size={18} color={colors.line} />}<T v="small" style={{ fontFamily: done ? fonts.semibold : fonts.body }} color={done ? colors.ink : colors.muted}>{label}</T></View>;
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.overlay },
  seg: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.surface },
});
