import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowLeftRight, BadgeCheck, Clock, Heart, MapPin, ShieldAlert, Truck, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Loading, T } from '@/components/ui';
import { absUrl, api, ApiError } from '@/lib/api';
import { useAuth, useRequireAccount } from '@/lib/auth';
import { confirm, notify } from '@/lib/confirm';
import { formatINR, timeAgo } from '@/lib/format';
import { CATEGORY_LABELS, CONDITION_LABELS, VALUE_DISCLAIMER } from '@/lib/shared';
import type { Listing, PublicProfile } from '@/lib/types';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

const CASH_TEXT = { NONE: 'Straight swaps only', WILL_ADD: 'Happy to add cash', WILL_ACCEPT: 'Open to receiving cash', EITHER: 'Cash either way is fine' } as const;

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const { status } = useAuth(); const requireAccount = useRequireAccount(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['listing', id, status === 'authed'], queryFn: () => api<Listing>(`/listings/${id}`), enabled: status !== 'loading' });
  const [page, setPage] = useState(0); const [fav, setFav] = useState<boolean | null>(null); const [removing, setRemoving] = useState(false);

  if (q.isPending) return <Loading />;
  if (q.error instanceof ApiError && q.error.status === 404) return <View style={{ flex: 1, paddingTop: insets.top }}><EmptyState icon={<ShieldAlert size={28} color={colors.coralInk} />} title="This listing isn't available" body="It may have been removed, or the owner has restricted who can see it." action={<Button title="Back to Discover" onPress={() => router.replace('/')} />} /></View>;
  if (q.isError) return <View style={{ flex: 1, paddingTop: insets.top }}><ErrorState onRetry={() => q.refetch()} /></View>;

  const l = q.data; const available = l.status === 'ACTIVE'; const isFav = fav ?? !!l.favorited;
  const place = [l.locationCity, l.locationRegion].filter(Boolean).join(', ');

  async function toggleFav() {
    if (!requireAccount()) return;
    const next = !isFav; setFav(next);
    try { await api(`/listings/${l.id}/favorite`, { method: next ? 'POST' : 'DELETE' }); qc.invalidateQueries({ queryKey: ['saved'] }); } catch { setFav(!next); }
  }
  async function remove() {
    if (!(await confirm('Remove this listing?', 'It disappears from Discover. Open offers on it are closed.', 'Remove', { destructive: true, cancelText: 'Keep it' }))) return;
    setRemoving(true);
    try { await api(`/listings/${l.id}`, { method: 'DELETE' }); qc.invalidateQueries(); if (router.canGoBack()) router.back(); else router.replace('/me'); }
    catch (e) { notify('Could not remove', e instanceof ApiError ? e.message : 'Try again.'); } finally { setRemoving(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* Gallery: swipe between photos */}
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {l.images.map((img) => <Image key={img.id} source={absUrl(img.url)} style={{ width, height: width * 1.1 }} contentFit="cover" transition={150} accessibilityLabel={img.altText ?? l.title} />)}
          </ScrollView>
          {l.images.length > 1 ? <View style={st.dots}>{l.images.map((img, i) => <View key={img.id} style={[st.dot, i === page && st.dotOn]} />)}</View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[st.float, { top: insets.top + 8, left: 16 }]}><ArrowLeft size={20} color={colors.ink} /></Pressable>
          {l.images.length > 1 ? <View style={[st.count, { top: insets.top + 14 }]}><T v="small" color={colors.paper} style={{ fontFamily: fonts.bold }}>{page + 1}/{l.images.length}</T></View> : null}
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Badge label={CATEGORY_LABELS[l.category]} tone="lilac" /><Badge label={CONDITION_LABELS[l.condition]} />
            {l.isSeedData ? <Badge label="Demo listing" tone="ink" /> : null}
          </View>
          <T v="display">{l.title}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
            <View style={st.row}><MapPin size={14} color={colors.muted} /><T v="small" color={colors.muted}>{place || 'Location not shared'}</T></View>
            <T v="small" color={colors.muted}>Listed {timeAgo(l.createdAt)}</T>
          </View>

          {!available ? (
            <View style={[st.banner, { backgroundColor: colors.butter }]}><Clock size={16} color={colors.butterInk} /><T v="small" color={colors.butterInk} style={{ flex: 1, fontFamily: fonts.semibold }}>{l.status === 'RESERVED' ? 'Reserved — this item is part of an agreed swap right now.' : l.status === 'EXCHANGED' ? 'Already swapped — this one found a new home.' : 'Not available for offers right now.'}</T></View>
          ) : null}

          <View style={[st.prompt, { backgroundColor: colors.coralSoft }]}>
            <T v="label" color={colors.coralInk}>I&apos;d swap this for</T>
            <T v="title" style={{ marginTop: 8 }}>{l.wantedText || 'Open to offers'}</T>
            {l.wantedCategories.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{l.wantedCategories.map((c) => <Badge key={c} label={CATEGORY_LABELS[c]} tone="ink" />)}</View> : null}
          </View>
          <View style={[st.prompt, { backgroundColor: colors.lilac }]}>
            <T v="label" color={colors.lavenderInk}>The story</T>
            <T style={{ marginTop: 8, fontSize: 16, lineHeight: 24 }}>{l.description}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[st.prompt, { flex: 1, backgroundColor: colors.mint }]}>
              <T v="label" color={colors.mintInk}>Cash</T>
              <T v="heading" style={{ marginTop: 8 }}>{CASH_TEXT[l.cashFlexibility]}</T>
            </View>
            <View style={[st.prompt, { flex: 1, backgroundColor: colors.butter }]}>
              <T v="label" color={colors.butterInk}>Exchange</T>
              {l.exchangeMethods.map((m) => <View key={m} style={[st.row, { marginTop: 8 }]}>{m === 'SHIPPING' ? <Truck size={16} color={colors.ink} /> : <Users size={16} color={colors.ink} />}<T v="strong">{m === 'SHIPPING' ? 'Shipping' : 'Meet-up'}</T></View>)}
            </View>
          </View>

          <Pressable onPress={() => router.push(`/user/${l.owner.id}`)} accessibilityRole="link">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={l.owner.displayName} url={l.owner.avatarUrl} size={52} />
              <View style={{ flex: 1 }}>
                <View style={st.row}><T v="heading" numberOfLines={1} style={{ flexShrink: 1 }}>{l.owner.displayName}</T>{l.owner.verified ? <BadgeCheck size={16} color={colors.mintInk} /> : null}</View>
                <T v="small" color={colors.muted}>{l.owner.locationCity ?? 'Location not shared'} · approximate area only</T>
                <OwnerStats id={l.owner.id} />
              </View>
            </Card>
          </Pressable>

          <View style={[st.banner, { backgroundColor: colors.butter }]}><ShieldAlert size={16} color={colors.butterInk} /><T v="small" color={colors.butterInk} style={{ flex: 1 }}>Inspect items before confirming a swap. Meet somewhere public. SWAPD never handles payments.</T></View>
          {l.estimatedValue != null ? <T v="small" color={colors.muted}>{VALUE_DISCLAIMER}</T> : null}
        </View>
      </ScrollView>

      {/* Sticky decision bar */}
      <View style={[st.bar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ minWidth: 76 }}><T v="label" color={colors.muted}>Estimate</T><T v="heading">{l.estimatedValue != null ? `~${formatINR(l.estimatedValue)}` : '—'}</T></View>
        {l.isOwner ? (
          <Button title="Remove listing" variant="danger" style={{ flex: 1 }} loading={removing} disabled={!available} onPress={remove} />
        ) : (
          <>
            <Button title={available ? 'Make an offer' : 'Not available'} icon={<ArrowLeftRight size={18} color={colors.ink} />} style={{ flex: 1 }} disabled={!available} onPress={() => requireAccount() && router.push(`/swap/${l.id}`)} />
            <Pressable accessibilityRole="button" accessibilityLabel={isFav ? 'Remove from saved' : 'Save item'} onPress={toggleFav} style={st.heart}><Heart size={22} color={isFav ? colors.coral : colors.ink} fill={isFav ? colors.coral : 'transparent'} /></Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function OwnerStats({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api<PublicProfile>(`/users/${id}`), staleTime: 60_000 });
  const st = q.data?.stats; if (!st) return null;
  return <T v="small" style={{ fontFamily: fonts.semibold, marginTop: 2 }}>{st.completedSwaps} swap{st.completedSwaps === 1 ? '' : 's'} completed · {st.averageRating != null ? `★ ${st.averageRating.toFixed(1)} (${st.reviewCount})` : 'No reviews yet'}</T>;
}

const st = StyleSheet.create({
  dots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 20, backgroundColor: '#FFFFFF' },
  float: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  count: { position: 'absolute', right: 16, backgroundColor: 'rgba(23,21,30,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14 },
  prompt: { borderRadius: 28, padding: 20 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
  heart: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
