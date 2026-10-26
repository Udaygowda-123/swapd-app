import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, MapPin, Package, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { ListingCard } from '@/components/listing-card';
import { Avatar, EmptyState, ErrorState, Skeleton, T } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Listing, Page, PublicProfile, Review } from '@/lib/types';
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

const Grid = ({ items }: { items: Listing[] }) => {
  const rows: Listing[][] = []; for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return <View style={{ gap: 18 }}>{rows.map((r) => <View key={r[0].id} style={s.grid}>{r.map((l) => <ListingCard key={l.id} listing={l} />)}{r.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>)}</View>;
};

/** A user's listings. Your own are grouped so unavailable ones are clearly separate (same groups as the web). */
export function UserListings({ userId, own }: { userId: string; own?: boolean }) {
  const q = useQuery({ queryKey: ['user-listings', userId], queryFn: () => api<Page<Listing>>(`/listings?ownerId=${userId}&limit=50`) });
  if (q.isPending) return <View style={s.grid}>{[0, 1].map((i) => <Skeleton key={i} style={{ flex: 1, aspectRatio: 0.8 }} />)}</View>;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const items = q.data.items;
  if (!items.length) return <EmptyState icon={<Package size={28} color={colors.coralInk} />} title={own ? "You haven't listed anything yet" : 'Nothing listed right now'} body={own ? 'List something you no longer use — someone out there wants it.' : undefined} />;
  if (!own) return <Grid items={items} />;
  const groups: [string, string, Listing['status']][] = [['Active', 'People can make offers on these.', 'ACTIVE'], ['In a deal', 'Reserved until the swap is completed or cancelled.', 'RESERVED'], ['Swapped', 'Completed swaps.', 'EXCHANGED'], ['Under review', 'Hidden while moderators check them.', 'UNDER_REVIEW']];
  return (
    <View style={{ gap: 26 }}>
      {groups.map(([title, hint, st]) => {
        const list = items.filter((l) => l.status === st); if (!list.length) return null;
        return <View key={st} style={{ gap: 10 }}><View><T v="heading">{title} <T color={colors.muted}>· {list.length}</T></T><T v="small" color={colors.muted}>{hint}</T></View><Grid items={list} /></View>;
      })}
    </View>
  );
}

export function UserReviews({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ['user-reviews', userId], queryFn: () => api<(Review & { author: { id: string; displayName: string } })[]>(`/users/${userId}/reviews`) });
  if (q.isPending) return <Skeleton style={{ height: 90 }} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data.length) return <EmptyState icon={<Star size={28} color={colors.coralInk} />} title="No reviews yet" body="Reviews appear after a swap is completed by both people." />;
  return (
    <View style={{ gap: 10 }}>
      {q.data.map((r) => (
        <View key={r.id} style={s.review}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} color={n <= r.rating ? colors.coral : colors.line} fill={n <= r.rating ? colors.coral : 'transparent'} />)}
            <T v="strong" style={{ fontSize: 14, marginLeft: 6 }}>{r.author.displayName}</T><T v="small" color={colors.muted}> · verified swap · {timeAgo(r.createdAt)}</T>
          </View>
          {r.body ? <T style={{ marginTop: 4 }}>{r.body}</T> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadow.card },
  avatar: { marginTop: -46, alignSelf: 'flex-start', borderRadius: 50, borderWidth: 4, borderColor: colors.surface },
  stats: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  grid: { flexDirection: 'row', gap: 12 },
  review: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14 },
});
