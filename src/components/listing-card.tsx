import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Heart, Images, MapPin, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { absUrl, api, ApiError } from '@/lib/api';
import { useAuth, useRequireAccount } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { CONDITION_LABELS } from '@/lib/shared';
import { useToast } from '@/lib/toast';
import type { ImageDto, Listing } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

export const coverImage = (l: Pick<Listing, 'images'>): ImageDto | undefined => l.images.find((i) => i.isCover) ?? l.images[0];
export const coverOf = (l: Pick<Listing, 'images'>) => { const c = coverImage(l); return absUrl(c?.thumbUrl ?? c?.url); };

const STATUS: Partial<Record<Listing['status'], { label: string; bg: string; fg: string }>> = {
  RESERVED: { label: 'In a deal', bg: colors.butter, fg: colors.butterInk }, EXCHANGED: { label: 'Swapped', bg: colors.mint, fg: colors.mintInk },
  REMOVED: { label: 'Removed', bg: colors.dangerSoft, fg: colors.danger }, UNDER_REVIEW: { label: 'Under review', bg: colors.dangerSoft, fg: colors.danger },
};

/** Warm the detail query when a finger lands on a card, so the listing screen opens with full data. */
export function usePrefetchListing() {
  const qc = useQueryClient(); const { status } = useAuth();
  return (id: string) => { void qc.prefetchQuery({ queryKey: ['listing', id, status === 'authed'], queryFn: () => api<Listing>(`/listings/${id}`), staleTime: 30_000 }); };
}

export function ListingCard({ listing, onDismiss }: { listing: Listing; onDismiss?: (id: string) => void }) {
  const qc = useQueryClient(); const requireAccount = useRequireAccount(); const toast = useToast(); const prefetch = usePrefetchListing();
  const [fav, setFav] = useState(!!listing.favorited); const [busy, setBusy] = useState(false);
  const cover = coverImage(listing); const status = STATUS[listing.status];

  async function toggleFav() {
    if (!requireAccount() || busy) return;
    const next = !fav; setFav(next); setBusy(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try { await api(`/listings/${listing.id}/favorite`, { method: next ? 'POST' : 'DELETE' }); qc.invalidateQueries({ queryKey: ['saved'] }); toast.success(next ? 'Saved' : 'Removed from saved'); }
    catch (e) { setFav(!next); toast.error(e instanceof ApiError ? e.message : 'Could not update saved items'); } finally { setBusy(false); }
  }

  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${listing.title}, ${formatINR(listing.estimatedValue)}`}
      onPressIn={() => prefetch(listing.id)} onPress={() => router.push(`/listing/${listing.id}`)}
      style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={s.media}>
        <Image source={absUrl(cover?.thumbUrl ?? cover?.url)} style={[StyleSheet.absoluteFill, listing.status !== 'ACTIVE' && { opacity: 0.6 }]} contentFit="cover" transition={180} recyclingKey={listing.id} cachePolicy="memory-disk" />
        <LinearGradient colors={['transparent', 'rgba(23,21,30,0.35)', 'rgba(23,21,30,0.82)']} style={s.shade} />
        <View style={s.badges}>
          {status ? <Text style={[s.badge, { backgroundColor: status.bg, color: status.fg }]}>{status.label}</Text> : null}
          {listing.isSeedData ? <Text style={s.badge}>Demo</Text> : null}
          {cover?.aiEdited ? <View style={[s.badgeRow, { backgroundColor: colors.lilac }]}><Sparkles size={10} color={colors.lavenderInk} /><Text style={[s.badgeText, { color: colors.lavenderInk }]}>AI-enhanced</Text></View> : null}
        </View>
        {listing.images.length > 1 ? <View style={[s.badgeRow, s.count]}><Images size={10} color={colors.paper} /><Text style={s.badgeText}>{listing.images.length}</Text></View> : null}
        {!listing.isOwner ? (
          <View style={s.actions}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: fav }} accessibilityLabel={fav ? `Remove ${listing.title} from saved` : `Save ${listing.title}`} hitSlop={6} onPress={toggleFav} style={s.round}>
              <Heart size={18} color={fav ? colors.coral : colors.ink} fill={fav ? colors.coral : 'transparent'} />
            </Pressable>
            {onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel={`Not interested in ${listing.title}`} hitSlop={6} onPress={() => onDismiss(listing.id)} style={s.round}><X size={17} color={colors.ink} /></Pressable> : null}
          </View>
        ) : null}
        <View style={s.caption}>
          <Text numberOfLines={2} style={s.title}>{listing.title}</Text>
          <Text numberOfLines={1} style={s.meta}>{listing.estimatedValue != null ? `~${formatINR(listing.estimatedValue)}` : 'No value'} · {CONDITION_LABELS[listing.condition]}</Text>
        </View>
      </View>
      <View style={s.below}>
        <View style={s.row}>
          <MapPin size={12} color={colors.muted} /><Text numberOfLines={1} style={[s.small, { flex: 1 }]}>{listing.locationCity ?? 'Location not shared'}</Text>
          <Text numberOfLines={1} style={[s.small, { color: colors.ink, fontFamily: fonts.medium, maxWidth: '45%' }]}>{listing.owner.displayName}</Text>
        </View>
        {listing.wantedText ? <Text numberOfLines={1} style={s.small}><Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>Wants</Text> · {listing.wantedText}</Text> : null}
        {listing.match?.reasons[0] ? <Text numberOfLines={1} style={s.match}>✦ {listing.match.reasons[0]}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1 },
  media: { aspectRatio: 0.8, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#EFEBE4' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },
  badges: { position: 'absolute', top: 8, left: 8, right: 52, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.ink, color: colors.paper, fontFamily: fonts.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, backgroundColor: colors.ink, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.paper },
  count: { position: 'absolute', right: 8, bottom: 62, backgroundColor: 'rgba(23,21,30,0.7)' },
  actions: { position: 'absolute', top: 8, right: 8, gap: 8 },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(250,248,245,0.95)', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 12, right: 12, bottom: 11 },
  title: { fontFamily: fonts.displayBold, fontSize: 15, lineHeight: 18, color: colors.paper },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(250,248,245,0.9)', marginTop: 3 },
  below: { paddingHorizontal: 4, paddingTop: 8, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, flexShrink: 1 },
  match: { alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden', marginTop: 3, borderRadius: 999, backgroundColor: colors.lilac, color: colors.lavenderInk, fontFamily: fonts.semibold, fontSize: 11, paddingHorizontal: 9, paddingVertical: 3 },
});
