import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Heart, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { absUrl, api } from '@/lib/api';
import { useRequireAccount } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { CONDITION_LABELS } from '@/lib/shared';
import type { Listing } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

export const coverOf = (l: Pick<Listing, 'images'>) => { const c = l.images.find((i) => i.isCover) ?? l.images[0]; return absUrl(c?.thumbUrl ?? c?.url); };

export function ListingCard({ listing }: { listing: Listing }) {
  const qc = useQueryClient(); const requireAccount = useRequireAccount();
  const [fav, setFav] = useState(!!listing.favorited); const [busy, setBusy] = useState(false);
  const place = [listing.locationCity, listing.locationRegion].filter(Boolean)[0];

  async function toggleFav() {
    if (!requireAccount() || busy) return;
    const next = !fav; setFav(next); setBusy(true);
    if (next && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try { await api(`/listings/${listing.id}/favorite`, { method: next ? 'POST' : 'DELETE' }); qc.invalidateQueries({ queryKey: ['saved'] }); }
    catch { setFav(!next); } finally { setBusy(false); }
  }

  return (
    <Pressable accessibilityRole="link" accessibilityLabel={listing.title} onPress={() => router.push(`/listing/${listing.id}`)} style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={s.media}>
        <Image source={coverOf(listing)} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={listing.id} />
        <LinearGradient colors={['transparent', 'rgba(23,21,30,0.78)']} style={s.shade} />
        {listing.isSeedData ? <Text style={s.demo}>Demo</Text> : null}
        {listing.status !== 'ACTIVE' ? <Text style={[s.demo, s.status, listing.isSeedData && { top: 40 }]}>{listing.status === 'RESERVED' ? 'In a deal' : listing.status === 'EXCHANGED' ? 'Swapped' : 'Hidden'}</Text> : null}
        {!listing.isOwner ? (
          <Pressable accessibilityRole="button" accessibilityLabel={fav ? 'Remove from saved' : 'Save item'} hitSlop={8} onPress={toggleFav} style={s.heart}>
            <Heart size={18} color={fav ? colors.coral : colors.ink} fill={fav ? colors.coral : 'transparent'} />
          </Pressable>
        ) : null}
        <View style={s.caption}>
          <Text numberOfLines={2} style={s.title}>{listing.title}</Text>
          <Text numberOfLines={1} style={s.meta}>{listing.estimatedValue != null ? `~${formatINR(listing.estimatedValue)} · ` : ''}{CONDITION_LABELS[listing.condition]}</Text>
        </View>
      </View>
      <View style={s.below}>
        {place ? <View style={s.row}><MapPin size={12} color={colors.muted} /><Text numberOfLines={1} style={s.small}>{place}</Text></View> : null}
        {listing.wantedText ? <Text numberOfLines={1} style={s.small}><Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>Wants</Text> · {listing.wantedText}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1 },
  media: { aspectRatio: 0.78, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#EFEBE4' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  demo: { position: 'absolute', top: 10, left: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.ink, color: colors.paper, fontFamily: fonts.bold, fontSize: 11, paddingHorizontal: 9, paddingVertical: 3 },
  status: { backgroundColor: colors.butter, color: colors.butterInk },
  heart: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 12, right: 12, bottom: 11 },
  title: { fontFamily: fonts.displayBold, fontSize: 15, lineHeight: 18, color: colors.paper },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(250,248,245,0.85)', marginTop: 3 },
  below: { paddingHorizontal: 4, paddingTop: 7, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, flexShrink: 1 },
});
