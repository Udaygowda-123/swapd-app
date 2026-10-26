import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/listing-card';
import { BackHeader, Button, EmptyState, ErrorState, Loading, T } from '@/components/ui';
import { api } from '@/lib/api';
import type { Listing } from '@/lib/types';
import { colors } from '@/theme/tokens';

export default function Saved() {
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['saved'], queryFn: () => api<Listing[]>('/favorites') });
  const items = (q.data ?? []).map((l) => ({ ...l, favorited: true }));
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <BackHeader fallback="/me" />
      <FlatList
        data={items.length % 2 ? [...items, null] : items} keyExtractor={(l, i) => l?.id ?? `pad-${i}`} numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }} contentContainerStyle={{ gap: 18, paddingBottom: 32 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.ink} />}
        ListHeaderComponent={<View style={{ paddingHorizontal: 20 }}><T v="display">Saved</T><T color={colors.muted}>Items you&apos;ve hearted.</T></View>}
        renderItem={({ item }) => (item ? <ListingCard listing={item} /> : <View style={{ flex: 1 }} />)}
        ListEmptyComponent={q.isPending ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <EmptyState icon={<Heart size={28} color={colors.coralInk} />} title="Nothing saved yet" body="Tap the heart on anything you like to keep it here." action={<Button title="Discover items" onPress={() => router.navigate('/')} />} />}
      />
    </View>
  );
}
