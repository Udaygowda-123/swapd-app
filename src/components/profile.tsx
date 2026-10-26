import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, MapPin, Package } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { ListingCard } from '@/components/listing-card';
import { Avatar, EmptyState, Skeleton, T } from '@/components/ui';
import { api } from '@/lib/api';
import type { Listing, Page, PublicProfile } from '@/lib/types';
import { colors, radius, shadow } from '@/theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Profile card with the brand cover accent (lilac → violet/coral), real stats only. */
export function ProfileHeader({ p, children }: { p: PublicProfile; children?: React.ReactNode }) {
  const joined = new Date(p.createdAt); const place = [p.locationCity, p.locationRegion].filter(Boolean).join(', ');
  return (
    <View style={s.card}>
      <LinearGradient colors={[colors.violet, colors.lilac, '#FFB4A3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 96 }} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <View style={s.avatar}><Avatar name={p.displayName} url={p.avatarUrl} size={88} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <T v="title" numberOfLines={1} style={{ flexShrink: 1 }}>{p.displayName}</T>
          {p.verified ? <BadgeCheck size={20} color={colors.mintInk} accessibilityLabel="Email verified" /> : null}
        </View>
        {p.bio ? <T color={colors.muted} style={{ marginTop: 4 }}>{p.bio}</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 8 }}>
          {place ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MapPin size={14} color={colors.muted} /><T v="small" color={colors.muted}>{place}</T></View> : null}
          <T v="small" color={colors.muted}>Joined {MONTHS[joined.getMonth()]} {joined.getFullYear()}</T>
        </View>
        <View style={s.stats}>
          {[[p.stats.completedSwaps, 'Swaps'], [p.stats.averageRating ? p.stats.averageRating.toFixed(1) : '—', 'Rating'], [p.stats.reviewCount, 'Reviews'], [p.stats.activeListings, 'Listed']].map(([v, l]) => (
            <View key={String(l)} style={{ alignItems: 'center', flex: 1 }}><T v="title" style={{ fontSize: 22 }}>{String(v)}</T><T v="small" color={colors.muted}>{l}</T></View>
          ))}
        </View>
        {children}
      </View>
    </View>
  );
}

/** A user's listings as a 2-column grid (no virtualisation needed at this size). */
export function UserListings({ userId, own }: { userId: string; own?: boolean }) {
  const q = useQuery({ queryKey: ['user-listings', userId], queryFn: () => api<Page<Listing>>(`/listings?ownerId=${userId}&limit=50`) });
  if (q.isPending) return <View style={s.grid}>{[0, 1].map((i) => <Skeleton key={i} style={{ flex: 1, aspectRatio: 0.78 }} />)}</View>;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState icon={<Package size={28} color={colors.coralInk} />} title={own ? "You haven't listed anything yet" : 'Nothing listed right now'} body={own ? 'List something you no longer use — someone out there wants it.' : undefined} />;
  const rows: Listing[][] = []; for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ gap: 18 }}>
      {rows.map((r) => <View key={r[0].id} style={s.grid}>{r.map((l) => <ListingCard key={l.id} listing={l} />)}{r.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>)}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow.card },
  avatar: { marginTop: -46, alignSelf: 'flex-start', borderRadius: 50, borderWidth: 4, borderColor: colors.surface },
  stats: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  grid: { flexDirection: 'row', gap: 12 },
});
