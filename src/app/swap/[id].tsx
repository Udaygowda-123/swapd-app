import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Send } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ItemPicker } from '@/components/item-picker';
import { ProposalStrip } from '@/components/proposal-strip';
import { BackHeader, Button, EmptyState, ErrorState, Field, Loading, T } from '@/components/ui';
import { absUrl, api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import type { Listing, ListingBrief, Offer, Page } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

type Terms = { give: string[]; get: string[]; cash: number; payer: 'ME' | 'THEM'; message: string };
const brief = (l: Listing): ListingBrief => { const c = l.images.find((i) => i.isCover) ?? l.images[0]; return { id: l.id, title: l.title, status: l.status, ownerId: l.ownerId, category: l.category, estimatedValue: l.estimatedValue, thumbUrl: absUrl(c?.thumbUrl ?? c?.url) }; };
const pool = (ownerId: string) => api<Page<Listing>>(`/listings?ownerId=${ownerId}&status=ACTIVE&limit=50`).then((p) => p.items.map(brief));

/**
 * Offer composer. /swap/<listingId> builds a new offer; /swap/<listingId>?counter=<offerId> counters an existing one.
 * The API always stores items as offered = sender's, requested = recipient's, and cashPayer relative to the author —
 * we show "You give / You get" and translate, exactly like the web app.
 */
export default function Composer() {
  const { id, counter } = useLocalSearchParams<{ id: string; counter?: string }>();
  const insets = useSafeAreaInsets(); const { user } = useAuth(); const qc = useQueryClient(); const me = user?.id;

  const target = useQuery({ queryKey: ['listing', id, true], queryFn: () => api<Listing>(`/listings/${id}`), enabled: !counter });
  const offer = useQuery({ queryKey: ['offer', counter], queryFn: () => api<Offer>(`/offers/${counter}`), enabled: !!counter });
  const iAmSender = offer.data ? offer.data.sender.id === me : true;
  const other = offer.data ? (iAmSender ? offer.data.recipient : offer.data.sender) : target.data?.owner;
  const pools = useQuery({
    queryKey: ['pools', other?.id, me], enabled: !!other && !!me,
    queryFn: async () => { const [mine, theirs] = await Promise.all([pool(me!), pool(other!.id)]); return { mine, theirs }; },
  });

  // Starting terms come from the loaded data; only the user's edits live in state.
  const initial = useMemo<Terms | null>(() => {
    if (counter) {
      if (!offer.data || !me) return null;
      const r = offer.data.revisions[offer.data.revisions.length - 1];
      return { give: (iAmSender ? r.offered : r.requested).map((i) => i.id), get: (iAmSender ? r.requested : r.offered).map((i) => i.id), cash: r.cashAmount, payer: r.cashPayerId === me || !r.cashAmount ? 'ME' : 'THEM', message: '' };
    }
    return target.data ? { give: [], get: [target.data.id], cash: 0, payer: 'ME', message: '' } : null;
  }, [counter, offer.data, target.data, me, iAmSender]);
  const [edited, setEdited] = useState<Terms | null>(null);
  const terms = edited ?? initial;

  const [step, setStep] = useState<'build' | 'review'>('build'); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const key = useRef(newIdempotencyKey());

  const give = useMemo(() => (pools.data?.mine ?? []).filter((i) => terms?.give.includes(i.id)), [pools.data, terms]);
  const get = useMemo(() => (pools.data?.theirs ?? []).filter((i) => terms?.get.includes(i.id)), [pools.data, terms]);

  if (target.isError || offer.isError || pools.isError) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader /><ErrorState onRetry={() => { target.refetch(); offer.refetch(); pools.refetch(); }} /></View>;
  if (!terms || pools.isPending || !other) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader /><Loading /></View>;
  if (!counter && target.data?.isOwner) return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader /><EmptyState icon={<ArrowRight size={28} color={colors.coralInk} />} title="That's your own item" body="You can't make an offer on something you listed." /></View>;
  if (!counter && target.data && target.data.status !== 'ACTIVE') return <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader /><EmptyState icon={<ArrowRight size={28} color={colors.coralInk} />} title="This item isn't available" body="It's already in a deal or has been swapped." /></View>;

  const valid = terms.get.length > 0 && (terms.give.length > 0 || terms.cash > 0);
  const set = (patch: Partial<Terms>) => setEdited({ ...terms, ...patch });

  async function send() {
    setBusy(true); setError(undefined);
    const t = terms!; const body = { cashAmount: t.cash, cashPayer: t.payer, message: t.message.trim() || undefined };
    try {
      let o: Offer;
      if (counter && offer.data) {
        o = await api<Offer>(`/offers/${counter}/counter`, { method: 'POST', idempotencyKey: key.current, body: { ...body, expectedVersion: offer.data.version, offeredListingIds: iAmSender ? t.give : t.get, requestedListingIds: iAmSender ? t.get : t.give } });
      } else {
        o = await api<Offer>('/offers', { method: 'POST', idempotencyKey: key.current, body: { ...body, offeredListingIds: t.give, requestedListingIds: t.get } });
      }
      qc.invalidateQueries({ queryKey: ['offers'] }); qc.invalidateQueries({ queryKey: ['offer', o.id] });
      router.replace(`/offer/${o.id}`);
    } catch (e) {
      key.current = newIdempotencyKey(); setStep('build');
      setError(e instanceof ApiError ? (e.code === 'OFFER_EXISTS' ? 'You already have an open offer on this item — find it under Offers.' : e.code === 'STALE_OFFER' ? 'The offer changed while you were editing. Go back and review the latest version.' : e.message) : 'Could not send. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  const title = counter ? 'Counter' : 'Build your';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}><BackHeader label={step === 'review' ? 'Edit' : counter ? 'Offer' : 'Back to item'} onPress={step === 'review' ? () => setStep('build') : undefined} /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 22, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View>
          <T v="display">{step === 'build' ? title : 'Review your'} <T v="accent" color={colors.cobaltInk}>{step === 'build' ? (counter ? 'offer' : 'swap') : 'offer'}</T></T>
          <T color={colors.muted} style={{ marginTop: 4 }}>with {other.displayName} · step {step === 'build' ? 1 : 2} of 2</T>
        </View>
        <ProposalStrip give={give} get={get} cash={terms.cash} cashFromYou={terms.payer === 'ME'} otherName={other.displayName} />

        {step === 'build' ? (
          <>
            <ItemPicker title={`You want — from ${other.displayName}`} hint="Pick one or more of their items." items={pools.data.theirs} selected={terms.get} onChange={(g) => set({ get: g })} />
            <ItemPicker title="You're offering" hint="Pick items you'd give. Leave empty to propose cash only." items={pools.data.mine} selected={terms.give} onChange={(g) => set({ give: g })}
              empty={<View style={s.dashed}><T v="strong">You have no active listings.</T><T v="small" color={colors.muted}>You can still propose cash only, or list an item to swap.</T></View>} />
            <View style={{ gap: 10 }}>
              <T v="heading">Cash difference <T color={colors.muted}>(optional)</T></T>
              <Field label="Amount (₹)" keyboardType="number-pad" value={terms.cash ? String(terms.cash) : ''} placeholder="0" onChangeText={(v) => set({ cash: Math.min(10_000_000, Math.max(0, parseInt(v.replace(/\D/g, ''), 10) || 0)) })} />
              <View style={s.segment} accessibilityRole="radiogroup">
                {(['ME', 'THEM'] as const).map((w) => (
                  <Pressable key={w} accessibilityRole="radio" accessibilityState={{ checked: terms.payer === w, disabled: !terms.cash }} disabled={!terms.cash} onPress={() => set({ payer: w })} style={[s.seg, terms.payer === w && s.segOn, !terms.cash && { opacity: 0.5 }]}>
                    <T v="strong" style={{ fontSize: 14 }}>{w === 'ME' ? 'I add cash' : 'They add cash'}</T>
                  </Pressable>
                ))}
              </View>
              {terms.cash > 0 ? <View style={s.mint}><T v="small" color={colors.mintInk}>{terms.payer === 'ME' ? 'You propose to add' : 'You ask them to add'} <T v="small" color={colors.mintInk} style={{ fontFamily: fonts.bold }}>{formatINR(terms.cash)}</T>. This is an agreed term only — SWAPD doesn&apos;t take or hold payments.</T></View> : null}
            </View>
            <Field label="Message (optional)" multiline maxLength={500} value={terms.message} onChangeText={(m) => set({ message: m })} placeholder="Say hi, explain your offer…" />
          </>
        ) : (
          <View style={s.butter}>
            <T v="strong" color={colors.butterInk}>Before you send</T>
            <T v="small" color={colors.butterInk}>• {other.displayName} can accept, counter, or decline. Nothing is agreed until someone accepts the exact terms.</T>
            <T v="small" color={colors.butterInk}>• The offer expires in 72 hours if nobody responds.</T>
            <T v="small" color={colors.butterInk}>• Cash is a negotiated proposal between you two. SWAPD never moves money.</T>
            {terms.message.trim() ? <T v="small" color={colors.butterInk} style={{ marginTop: 6 }}>Your message: “{terms.message.trim()}”</T> : null}
          </View>
        )}
        {error ? <View accessibilityRole="alert" style={s.err}><T v="small" color={colors.danger} style={{ fontFamily: fonts.semibold }}>{error}</T></View> : null}
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'build' ? (
          <>
            <Button title="Review offer" size="lg" disabled={!valid} icon={<ArrowRight size={18} color={colors.ink} />} onPress={() => setStep('review')} />
            {!valid ? <T v="small" color={colors.muted} style={{ textAlign: 'center' }}>Pick an item you want, plus something to offer or a cash amount.</T> : null}
          </>
        ) : (
          <Button title={counter ? 'Send counteroffer' : 'Send offer'} size="lg" loading={busy} icon={<Send size={18} color={colors.ink} />} onPress={send} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  dashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 16, padding: 16, gap: 2 },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.overlay },
  seg: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.surface },
  mint: { backgroundColor: colors.mint, borderRadius: 16, padding: 14 },
  butter: { backgroundColor: colors.butter, borderRadius: 20, padding: 16, gap: 6 },
  err: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 6, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
});
