import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Handshake } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProposalStrip } from '@/components/proposal-strip';
import { BackHeader, Badge, Button, EmptyState, ErrorState, Loading, T, type Tone } from '@/components/ui';
import { api } from '@/lib/api';
import { usePullRefresh } from '@/lib/use-pull-refresh';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { DealStatus } from '@/lib/shared';
import type { Deal } from '@/lib/types';
import { colors, radius, shadow } from '@/theme/tokens';

const TONE: Record<DealStatus, Tone> = { ACTIVE: 'butter', COMPLETED: 'mint', CANCELLED: 'neutral', DISPUTED: 'danger' };

export default function Deals() {
  const insets = useSafeAreaInsets(); const { user } = useAuth();
  const q = useQuery({ queryKey: ['deals'], queryFn: () => api<Deal[]>('/deals') });
  const pull = usePullRefresh(q.refetch);
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <BackHeader fallback="/me" />
      <FlatList
        data={q.data ?? []} keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 32 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.ink} />}
        ListHeaderComponent={<View style={{ paddingBottom: 6 }}><T v="display">Deals</T><T color={colors.muted}>Accepted swaps and where they stand.</T></View>}
        renderItem={({ item: d }) => (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/deal/${d.id}`)} style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.985 }] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Badge label={d.status.toLowerCase()} tone={TONE[d.status]} />
              <T v="strong" numberOfLines={1} style={{ flex: 1 }}>with {d.counterpart.displayName}</T>
              <T v="small" color={colors.muted}>{timeAgo(d.completedAt ?? d.createdAt)}</T>
            </View>
            <ProposalStrip give={d.terms.giving} get={d.terms.receiving} cash={d.terms.cashAmount} cashFromYou={d.terms.cashPayerId === user?.id} otherName={d.counterpart.displayName} light />
          </Pressable>
        )}
        ListEmptyComponent={q.isPending ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <EmptyState icon={<Handshake size={28} color={colors.coralInk} />} title="No deals yet" body="When an offer is accepted, the deal and its next steps appear here." action={<Button title="See your offers" onPress={() => router.navigate('/offers')} />} />}
      />
    </View>
  );
}

const s = StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 12, ...shadow.card } });
