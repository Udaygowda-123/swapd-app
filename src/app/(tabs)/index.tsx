import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Layers, LayoutGrid, Plus, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellButton } from '@/components/bell-button';
import { CATEGORY_ICON } from '@/components/category-icons';
import { activeFilterCount, FiltersSheet, NO_FILTERS, type Filters } from '@/components/filters-sheet';
import { ListingCard } from '@/components/listing-card';
import { SwipeDeck } from '@/components/swipe-deck';
import { Button, Chip, EmptyState, ErrorState, Skeleton, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/shared';
import { useToast } from '@/lib/toast';
import { usePullRefresh } from '@/lib/use-pull-refresh';
import type { Listing, Page } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

type Sort = 'best' | 'new'; type Mode = 'grid' | 'swipe';

export default function Discover() {
  const insets = useSafeAreaInsets(); const { status } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const [text, setText] = useState(''); const [q, setQ] = useState(''); const [category, setCategory] = useState<Category | null>(null);
  const [sort, setSort] = useState<Sort>('best'); const [mode, setMode] = useState<Mode>('grid');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS); const [filtersOpen, setFiltersOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(t); }, [text]); // debounce typing

  const qs = useMemo(() => new URLSearchParams(Object.entries({ q, category: category ?? '', ...filters }).filter(([, v]) => v)).toString(), [q, category, filters]);
  const feed = useInfiniteQuery({
    queryKey: ['discover', qs, sort, status === 'authed'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const page = `limit=20${pageParam ? `&cursor=${pageParam}` : ''}`;
      if (sort === 'best') return api<Page<Listing>>(`/discover?${qs}${qs ? '&' : ''}${page}`, { signal });
      // Newest uses the listings endpoint with the same filters; hide your own items like the ranked feed does.
      const r = await api<Page<Listing>>(`/listings?${qs}${qs ? '&' : ''}status=ACTIVE&${page}`, { signal });
      return { ...r, items: r.items.filter((l) => !l.isOwner) };
    },
    getNextPageParam: (p) => p.pageInfo.nextCursor,
    enabled: status !== 'loading',
    staleTime: 60_000,
    placeholderData: keepPreviousData, // keep showing current results while a new filter/sort loads — no flash to skeletons
  });
  const all = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const items = useMemo(() => all.filter((l) => !hidden.has(l.id)), [all, hidden]);
  const nFilters = activeFilterCount(filters);
  const hasQuery = !!qs;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const fetchMore = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const clearAll = () => { setText(''); setQ(''); setCategory(null); setFilters(NO_FILTERS); };
  const { refetch } = feed;
  const pull = usePullRefresh(useCallback(() => { setHidden(new Set()); return refetch(); }, [refetch]));

  async function dismiss(id: string) {
    setHidden((h) => new Set(h).add(id));
    try { await api(`/listings/${id}/dismiss`, { method: 'POST' }); toast.info("Got it — we'll show you less like that"); }
    catch { setHidden((h) => { const n = new Set(h); n.delete(id); return n; }); toast.error('Could not hide that item'); }
  }
  // Swipe decisions hide the item from the grid too (the deck itself walks the unfiltered list so its position never jumps).
  const decided = useCallback((id: string) => { setHidden((h) => new Set(h).add(id)); qc.invalidateQueries({ queryKey: ['saved'] }); }, [qc]);

  const header = (
    <View style={{ paddingTop: insets.top + 4, gap: 10, paddingBottom: 10 }}>
      <View style={{ paddingHorizontal: 20 }}>
        {mode === 'grid' ? (
          <>
            {/* Bell floats beside the label/heading so it doesn't add a row of its own */}
            <View style={{ position: 'absolute', right: 20, top: 0, zIndex: 1 }}><BellButton /></View>
            <T v="label" color={colors.coralInk} style={{ marginTop: 6 }}>Discover</T>
            <T v="display" style={{ marginTop: 2, marginRight: 52 }}>Find your next <T v="accent" color={colors.cobaltInk}>favourite</T></T>
            <T color={colors.muted} style={{ marginTop: 4 }}>{status === 'authed' ? 'Picked for what you want and what you have.' : 'Browse what people are swapping. Sign in for a feed tuned to you.'}</T>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="label" color={colors.coralInk}>Discover</T>
            <BellButton />
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
        <View style={st.search}>
          <Search size={18} color={colors.muted} />
          <TextInput value={text} onChangeText={setText} placeholder="Search sneakers, cameras, vinyl…" placeholderTextColor={colors.muted} returnKeyType="search" style={st.searchInput} accessibilityLabel="Search items" />
          {text ? <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setText('')}><X size={18} color={colors.muted} /></Pressable> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Filters${nFilters ? `, ${nFilters} active` : ''}`} onPress={() => setFiltersOpen(true)} style={[st.filterBtn, nFilters > 0 && { borderColor: colors.ink }]}>
          <SlidersHorizontal size={18} color={colors.ink} />
          {nFilters ? <View style={st.count}><T v="small" style={{ fontFamily: fonts.bold, fontSize: 11 }}>{nFilters}</T></View> : null}
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        <Chip label="All" active={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => { const I = CATEGORY_ICON[c]; const on = category === c; return <Chip key={c} label={CATEGORY_LABELS[c]} active={on} onPress={() => setCategory(on ? null : c)} icon={<I size={15} color={on ? colors.paper : colors.ink} />} />; })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, justifyContent: 'space-between' }}>
        <Segment value={sort} onChange={setSort} label="Sort" options={[{ v: 'best', text: 'Best match' }, { v: 'new', text: 'Newest' }]} />
        <Segment value={mode} onChange={setMode} label="View" options={[{ v: 'grid', label: 'Grid view', icon: <LayoutGrid size={18} color={colors.ink} /> }, { v: 'swipe', label: 'Swipe view', icon: <Layers size={18} color={colors.ink} /> }]} />
      </View>
    </View>
  );

  const empty = feed.isPending || status === 'loading'
    ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ width: '47%', aspectRatio: 0.8 }} />)}</View>
    : feed.isError ? <ErrorState message="We couldn't load the feed." onRetry={() => feed.refetch()} />
      : <EmptyState icon={<Search size={28} color={colors.coralInk} />} title={hasQuery ? 'Nothing matches those filters' : 'No items yet'} body={hasQuery ? 'Try a different search, or clear your filters.' : 'Be the first to list something — others will find it here.'}
        action={hasQuery ? <Button title="Clear filters" variant="outline" onPress={clearAll} /> : <Button title="List an item" icon={<Plus size={16} color={colors.ink} />} onPress={() => router.push(status === 'authed' ? '/listing/new' : '/login')} />} />;

  const sheet = <FiltersSheet open={filtersOpen} value={filters} onClose={() => setFiltersOpen(false)} onApply={setFilters} />;
  const refreshControl = <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.ink} />;

  if (mode === 'swipe') return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} refreshControl={refreshControl}>
        {header}
        {all.length ? <SwipeDeck key={qs + sort} items={all} hasMore={!!feed.hasNextPage} onNeedMore={fetchMore} onDecided={decided} /> : empty}
      </ScrollView>
      {sheet}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items.length % 2 ? [...items, null] : items} keyExtractor={(l, i) => l?.id ?? `pad-${i}`} numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 16, paddingBottom: 28 }}
        renderItem={({ item }) => (item ? <ListingCard listing={item} onDismiss={status === 'authed' ? dismiss : undefined} /> : <View style={{ flex: 1 }} />)} // pad keeps an odd last card half-width
        onEndReachedThreshold={0.8} onEndReached={fetchMore}
        initialNumToRender={6} maxToRenderPerBatch={8} windowSize={9}
        refreshControl={refreshControl}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={empty}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: 8 }} color={colors.ink} /> : undefined}
      />
      {sheet}
    </View>
  );
}

/** Segmented control; options with only an icon render as compact square buttons (labelled for screen readers). */
function Segment<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { v: V; text?: string; label?: string; icon?: React.ReactNode }[]; label: string }) {
  return (
    <View style={st.segment} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => (
        <Pressable key={o.v} accessibilityRole="tab" accessibilityLabel={o.label ?? o.text} accessibilityState={{ selected: value === o.v }} onPress={() => onChange(o.v)} style={[st.segBtn, !o.text && st.segIcon, value === o.v && st.segOn]}>
          {o.icon}{o.text ? <T v="strong" style={{ fontSize: 13.5 }}>{o.text}</T> : null}
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, height: '100%' },
  filterBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.overlay },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: radius.pill },
  segIcon: { width: 40, paddingHorizontal: 0, justifyContent: 'center' },
  segOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
