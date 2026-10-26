import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowLeftRight, BadgeCheck, ChevronRight, Clock, Flag, Heart, MapPin, Pencil, ShieldAlert, Sparkles, Trash2, Truck, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lightbox } from '@/components/lightbox';
import { ListingCard } from '@/components/listing-card';
import { ReportSheet } from '@/components/report-sheet';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton, T } from '@/components/ui';
import { absUrl, api, ApiError } from '@/lib/api';
import { useAuth, useRequireAccount } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatINR, timeAgo } from '@/lib/format';
import { cardSeed } from '@/lib/seed';
import { CATEGORY_LABELS, CONDITION_LABELS, VALUE_DISCLAIMER, type CashFlexibility } from '@/lib/shared';
import { useToast } from '@/lib/toast';
import type { Listing, PublicProfile } from '@/lib/types';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

// Same wording as the web listing page.
const CASH_TEXT: Record<CashFlexibility, string> = { NONE: 'Prefers a straight swap', WILL_ADD: 'Happy to add cash', WILL_ACCEPT: 'Happy to take cash on top', EITHER: 'Open to cash either way' };
const STATUS = { RESERVED: ['butter', 'In a deal'], EXCHANGED: ['mint', 'Swapped'], REMOVED: ['danger', 'Removed'], UNDER_REVIEW: ['danger', 'Under review'] } as const;

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const { status } = useAuth(); const requireAccount = useRequireAccount(); const qc = useQueryClient(); const toast = useToast();
  // Paint instantly from a card we already have (feed, saved, profile, related), then load the full listing.
  const q = useQuery({ queryKey: ['listing', id, status === 'authed'], queryFn: () => api<Listing>(`/listings/${id}`), enabled: status !== 'loading', retry: false, placeholderData: (prev) => prev ?? cardSeed(qc, id) });
  const [page, setPage] = useState(0); const [viewer, setViewer] = useState<number | null>(null);
  const [fav, setFav] = useState<boolean | null>(null); const [removing, setRemoving] = useState(false); const [reporting, setReporting] = useState(false);

  if (!q.data && q.isPending) return <View style={{ flex: 1 }}><Skeleton style={{ width, height: width * 1.1, borderRadius: 0 }} /><View style={{ padding: 20, gap: 12 }}><Skeleton style={{ height: 36, width: '70%' }} /><Skeleton style={{ height: 120 }} /></View></View>;
  if (q.error instanceof ApiError && q.error.status === 404) return <View style={{ flex: 1, paddingTop: insets.top }}><EmptyState icon={<ShieldAlert size={28} color={colors.coralInk} />} title="This listing isn't available" body="It may have been removed, or the owner has restricted who can see it." action={<Button title="Back to Discover" onPress={() => router.replace('/')} />} /></View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, paddingTop: insets.top }}><ErrorState onRetry={() => q.refetch()} /></View>;

  const l = q.data; const available = l.status === 'ACTIVE'; const isFav = fav ?? !!l.favorited;
  const pending = q.isPlaceholderData && status === 'authed'; // viewer-specific flags (isOwner, favorited) not loaded yet
  const place = [l.locationCity, l.locationRegion].filter(Boolean).join(', ');
  const st = l.status !== 'ACTIVE' ? STATUS[l.status] : null;

  async function toggleFav() {
    if (!requireAccount()) return;
    const next = !isFav; setFav(next);
    try { await api(`/listings/${l.id}/favorite`, { method: next ? 'POST' : 'DELETE' }); qc.invalidateQueries({ queryKey: ['saved'] }); toast.success(next ? 'Saved' : 'Removed from saved'); }
    catch { setFav(!next); toast.error('Could not update saved items'); }
  }
  async function remove() {
    if (!(await confirm('Remove this listing?', "Open offers involving it will be closed. This can't be undone from your side.", 'Remove listing', { destructive: true, cancelText: 'Keep it' }))) return;
    setRemoving(true);
    try { await api(`/listings/${l.id}`, { method: 'DELETE' }); toast.success('Listing removed'); qc.invalidateQueries(); if (router.canGoBack()) router.back(); else router.replace('/me'); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not remove listing'); } finally { setRemoving(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View>
          {l.images.length ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {l.images.map((img, i) => (
                <Pressable key={img.id} accessibilityRole="imagebutton" accessibilityLabel={`Open photo ${i + 1} of ${l.images.length} full screen`} onPress={() => setViewer(i)}>
                  <Image source={absUrl(img.url)} placeholder={absUrl(img.thumbUrl)} style={{ width, height: width * 1.15 }} contentFit="cover" transition={150} cachePolicy="memory-disk" accessibilityLabel={img.altText ?? l.title} />
                </Pressable>
              ))}
            </ScrollView>
          ) : <View style={{ width, height: width * 0.8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEBE4' }}><T color={colors.muted}>No photos</T></View>}
          {l.images.length > 1 ? <View style={s.dots}>{l.images.map((img, i) => <View key={img.id} style={[s.dot, i === page && s.dotOn]} />)}</View> : null}
          {l.images[0]?.aiEdited && page === 0 ? <View style={s.ai}><Sparkles size={12} color={colors.lavenderInk} /><T v="small" color={colors.lavenderInk} style={{ fontFamily: fonts.bold }}>AI-enhanced · original kept</T></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[s.float, { top: insets.top + 8, left: 16 }]}><ArrowLeft size={20} color={colors.ink} /></Pressable>
          {l.images.length > 1 ? <View style={[s.count, { top: insets.top + 14 }]}><T v="small" color={colors.paper} style={{ fontFamily: fonts.bold }}>{page + 1}/{l.images.length}</T></View> : null}
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Badge label={CATEGORY_LABELS[l.category]} tone="lilac" /><Badge label={CONDITION_LABELS[l.condition]} />
            {st ? <Badge label={st[1]} tone={st[0]} /> : null}
            {l.isSeedData ? <Badge label="Demo listing" tone="ink" /> : null}
          </View>
          <T v="display">{l.title}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
            <View style={s.row}><MapPin size={14} color={colors.muted} /><T v="small" color={colors.muted}>{place || 'Location not shared'}</T></View>
            {l.createdAt ? <T v="small" color={colors.muted}>Listed {timeAgo(l.createdAt)}</T> : null}
            <T v="small" color={colors.muted}>{l.images.length} photo{l.images.length === 1 ? '' : 's'}</T>
          </View>

          {!available ? (
            <View style={[s.banner, { backgroundColor: colors.butter }]}><Clock size={16} color={colors.butterInk} /><T v="small" color={colors.butterInk} style={{ flex: 1, fontFamily: fonts.semibold }}>{l.status === 'RESERVED' ? 'Reserved — this item is part of an agreed swap right now.' : l.status === 'EXCHANGED' ? 'Already swapped — this one found a new home.' : 'Not available for offers right now.'}</T></View>
          ) : null}

          <View style={[s.prompt, { backgroundColor: colors.coralSoft }]}>
            <T v="label" color={colors.coralInk}>I&apos;d swap this for</T>
            <T v="title" style={{ marginTop: 8 }}>{l.wantedText || 'Open to offers'}</T>
            {l.wantedCategories.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{l.wantedCategories.map((c) => <Badge key={c} label={CATEGORY_LABELS[c]} tone="ink" />)}</View> : null}
          </View>
          <View style={[s.prompt, { backgroundColor: colors.lilac }]}>
            <T v="label" color={colors.lavenderInk}>The story</T>
            <T style={{ marginTop: 8, fontSize: 16, lineHeight: 24 }}>{l.description}</T>
          </View>
          {l.images[3] ? <Pressable onPress={() => setViewer(3)} accessibilityRole="imagebutton" accessibilityLabel="Open photo 4"><Image source={absUrl(l.images[3].url)} style={s.extra} contentFit="cover" cachePolicy="memory-disk" /></Pressable> : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[s.prompt, { flex: 1, backgroundColor: colors.mint }]}>
              <T v="label" color={colors.mintInk}>Cash difference</T>
              <T v="heading" style={{ marginTop: 8 }}>{CASH_TEXT[l.cashFlexibility]}</T>
              <T v="small" color={colors.mintInk} style={{ marginTop: 6 }}>Only ever a proposal between you two.</T>
            </View>
            <View style={[s.prompt, { flex: 1, backgroundColor: colors.butter }]}>
              <T v="label" color={colors.butterInk}>How to exchange</T>
              {l.exchangeMethods.map((m) => <View key={m} style={[s.row, { marginTop: 8 }]}>{m === 'SHIPPING' ? <Truck size={16} color={colors.ink} /> : <Users size={16} color={colors.ink} />}<T v="strong">{m === 'SHIPPING' ? 'Shipping' : 'Local meet-up'}</T></View>)}
            </View>
          </View>

          <Pressable onPress={() => router.push(`/user/${l.owner.id}`)} accessibilityRole="link" accessibilityLabel={`View ${l.owner.displayName}'s profile`}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={l.owner.displayName} url={l.owner.avatarUrl} size={52} />
              <View style={{ flex: 1 }}>
                <View style={s.row}><T v="heading" numberOfLines={1} style={{ flexShrink: 1 }}>{l.owner.displayName}</T>{l.owner.verified ? <BadgeCheck size={16} color={colors.mintInk} accessibilityLabel="Verified email" /> : null}</View>
                <T v="small" color={colors.muted}>{l.owner.locationCity ?? 'Location not shared'} · approximate area only</T>
                <OwnerStats id={l.owner.id} />
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Card>
          </Pressable>

          <View style={[s.banner, { backgroundColor: colors.butter }]}><ShieldAlert size={16} color={colors.butterInk} /><T v="small" color={colors.butterInk} style={{ flex: 1 }}>Inspect items before confirming and meet somewhere public. Nothing is agreed until someone accepts exact terms. {VALUE_DISCLAIMER}</T></View>
          {!l.isOwner && !pending ? (
            <Pressable accessibilityRole="button" onPress={() => requireAccount() && setReporting(true)} style={[s.row, { alignSelf: 'flex-start', paddingVertical: 6 }]}>
              <Flag size={15} color={colors.muted} /><T v="small" color={colors.muted} style={{ textDecorationLine: 'underline' }}>Report this listing</T>
            </Pressable>
          ) : null}

          {l.related?.length ? (
            <View style={{ gap: 14, marginTop: 12 }}>
              <T v="title">More in {CATEGORY_LABELS[l.category]}</T>
              {chunk(l.related.slice(0, 4), 2).map((r) => <View key={r[0].id} style={{ flexDirection: 'row', gap: 12 }}>{r.map((x) => <ListingCard key={x.id} listing={x} />)}{r.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>)}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky decision bar */}
      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ minWidth: 78 }}><T v="label" color={colors.muted}>Estimate</T><T v="heading">{l.estimatedValue != null ? `~${formatINR(l.estimatedValue)}` : '—'}</T></View>
        {pending ? <Skeleton style={{ flex: 1, height: 48, borderRadius: radius.pill }} /> : l.isOwner ? (
          <>
            <Button title="Edit" variant="outline" style={{ flex: 1 }} icon={<Pencil size={16} color={colors.ink} />} disabled={!available} onPress={() => router.push(`/listing/edit/${l.id}`)} />
            <Button title="Remove" variant="danger" style={{ flex: 1 }} icon={<Trash2 size={16} color={colors.danger} />} loading={removing} disabled={l.status === 'RESERVED' || l.status === 'EXCHANGED'} onPress={remove} />
          </>
        ) : (
          <>
            <Button title={available ? 'Make an offer' : 'Not available'} icon={<ArrowLeftRight size={18} color={colors.ink} />} style={{ flex: 1 }} disabled={!available} onPress={() => requireAccount() && router.push(`/swap/${l.id}`)} />
            <Pressable accessibilityRole="button" accessibilityState={{ selected: isFav }} accessibilityLabel={isFav ? 'Remove from saved' : 'Save item'} onPress={toggleFav} style={s.heart}><Heart size={22} color={isFav ? colors.coral : colors.ink} fill={isFav ? colors.coral : 'transparent'} /></Pressable>
          </>
        )}
      </View>

      <Lightbox images={l.images} title={l.title} start={viewer ?? 0} open={viewer !== null} onClose={() => setViewer(null)} />
      <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="LISTING" targetId={l.id} subject="this listing" />
    </View>
  );
}

const chunk = <V,>(a: V[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function OwnerStats({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api<PublicProfile>(`/users/${id}`), staleTime: 5 * 60_000 });
  const st = q.data?.stats; if (!st) return null;
  return <T v="small" style={{ fontFamily: fonts.semibold, marginTop: 2 }}>{st.completedSwaps} swap{st.completedSwaps === 1 ? '' : 's'} completed · {st.averageRating != null ? `★ ${st.averageRating.toFixed(1)} (${st.reviewCount})` : 'No reviews yet'}</T>;
}

const s = StyleSheet.create({
  dots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 22, backgroundColor: '#FFFFFF' },
  ai: { position: 'absolute', left: 14, bottom: 34, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.lilac, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  float: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  count: { position: 'absolute', right: 16, backgroundColor: 'rgba(23,21,30,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14 },
  prompt: { borderRadius: 28, padding: 20 },
  extra: { width: '100%', aspectRatio: 4 / 3, borderRadius: 28 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
  heart: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
