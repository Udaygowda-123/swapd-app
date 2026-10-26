import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Star, UserX } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileHeader, UserListings } from '@/components/profile';
import { BackHeader, EmptyState, ErrorState, Loading, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { PublicProfile, Review } from '@/lib/types';
import { colors } from '@/theme/tokens';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api<PublicProfile>(`/users/${id}`) });
  const reviews = useQuery({ queryKey: ['user-reviews', id], queryFn: () => api<(Review & { author: { id: string; displayName: string } })[]>(`/users/${id}/reviews`) });

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <BackHeader />
      {q.isPending ? <Loading /> : q.error instanceof ApiError && q.error.status === 404 ? <EmptyState icon={<UserX size={28} color={colors.coralInk} />} title="Profile not found" />
        : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 18, paddingBottom: 40 + insets.bottom }}>
            <ProfileHeader p={q.data} />
            <T v="title">Listings</T>
            <UserListings userId={id} />
            <T v="title">Reviews</T>
            {reviews.data?.length ? reviews.data.map((r) => (
              <View key={r.id} style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} color={n <= r.rating ? colors.coral : colors.line} fill={n <= r.rating ? colors.coral : 'transparent'} />)}<T v="small" color={colors.muted}>  {r.author.displayName} · verified swap · {timeAgo(r.createdAt)}</T></View>
                {r.body ? <T>{r.body}</T> : null}
              </View>
            )) : <T color={colors.muted}>No reviews yet — reviews appear after a swap is completed by both people.</T>}
          </ScrollView>
        )}
    </View>
  );
}
