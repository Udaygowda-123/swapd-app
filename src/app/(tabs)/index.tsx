import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_ICON } from '@/components/category-icons';
import { ListingCard } from '@/components/listing-card';
import { Chip, EmptyState, ErrorState, Skeleton, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/shared';
import type { Listing, Page } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

type Sort = 'best' | 'new';

export default function Discover() {
  const insets = useSafeAreaInsets(); const { status } = useAuth();
  const [text, setText] = useState(''); const [q, setQ] = useState(''); const [category, setCategory] = useState<Category | null>(null); const [sort, setSort] = useState<Sort>('best');
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(t); }, [text]); // debounce search

  const qs = useMemo(() => new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}) }).toString(), [q, category]);
  const feed = useInfiniteQuery({
    queryKey: ['discover', qs, sort, status === 'authed'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = `limit=20${pageParam ? `&cursor=${pageParam}` : ''}`;
      if (sort === 'best') return api<Page<Listing>>(`/discover?${qs}${qs ? '&' : ''}${page}`);
      // Newest uses the listings endpoint with the same filters; hide your own items like the ranked feed does.
      const r = await api<Page<Listing>>(`/listings?${qs}${qs ? '&' : ''}status=ACTIVE&${page}`);
      return { ...r, items: r.items.filter((l) => !l.isOwner) };
    },
    getNextPageParam: (p) => p.pageInfo.nextCursor,
    enabled: status !== 'loading',
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  const header = (
    <View style={{ paddingTop: insets.top + 8, gap: 14, paddingBottom: 14 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <T v="label" color={colors.coralInk}>Discover</T>
        <T v="display" style={{ marginTop: 4 }}>Find your next <T v="accent" color={colors.cobaltInk}>favourite</T></T>
      </View>
      <View style={[st.search, { marginHorizontal: 20 }]}>
        <Search size={18} color={colors.muted} />
        <TextInput value={text} onChangeText={setText} placeholder="Search sneakers, cameras, vinyl…" placeholderTextColor={colors.muted} returnKeyType="search" style={st.searchInput} accessibilityLabel="Search listings" />
        {text ? <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setText('')}><X size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        <Chip label="All" active={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => { const I = CATEGORY_ICON[c]; const on = category === c; return <Chip key={c} label={CATEGORY_LABELS[c]} active={on} onPress={() => setCategory(on ? null : c)} icon={<I size={15} color={on ? colors.paper : colors.ink} />} />; })}
      </ScrollView>
      <View style={[st.segment, { marginHorizontal: 20 }]} accessibilityRole="tablist">
        {(['best', 'new'] as const).map((v) => (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: sort === v }} onPress={() => setSort(v)} style={[st.segBtn, sort === v && st.segOn]}>
            <T v="strong" style={{ fontSize: 14 }}>{v === 'best' ? 'Best match' : 'Newest'}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      data={items.length % 2 ? [...items, null] : items} keyExtractor={(l, i) => l?.id ?? `pad-${i}`} numColumns={2}
      ListHeaderComponent={header}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
      contentContainerStyle={{ gap: 18, paddingBottom: 32 }}
      renderItem={({ item }) => (item ? <ListingCard listing={item} /> : <View style={{ flex: 1 }} />)} // pad keeps an odd last card half-width
      onEndReachedThreshold={0.6}
      onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage(); }}
      refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => { feed.refetch(); }} tintColor={colors.ink} />}
      keyboardDismissMode="on-drag"
      ListEmptyComponent={
        feed.isPending ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ width: '47%', aspectRatio: 0.78 }} />)}</View>
          : feed.isError ? <ErrorState onRetry={() => feed.refetch()} />
            : <EmptyState icon={<Search size={28} color={colors.coralInk} />} title={qs ? 'No matches yet' : 'Nothing to discover yet'} body={qs ? 'Try a different search or category.' : 'New items show up here as people list them.'} />
      }
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: 8 }} color={colors.ink} /> : undefined}
    />
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, height: '100%' },
  segment: { flexDirection: 'row', alignSelf: 'flex-start', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.overlay },
  segBtn: { height: 38, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
