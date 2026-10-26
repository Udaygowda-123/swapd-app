import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellButton } from '@/components/bell-button';
import { ProposalStrip } from '@/components/proposal-strip';
import { Avatar, Badge, Button, Chip, EmptyState, ErrorState, Skeleton, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR, timeAgo, timeLeft } from '@/lib/format';
import { GROUPS, groupOf, isOpen, mySide, OFFER_STATUS } from '@/lib/offers';
import type { Offer, Page } from '@/lib/types';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

const BOXES = [{ id: 'all', label: 'All' }, { id: 'received', label: 'Received' }, { id: 'sent', label: 'Sent' }] as const;

export default function Offers() {
  const insets = useSafeAreaInsets(); const { user, status } = useAuth();
  const [box, setBox] = useState<(typeof BOXES)[number]['id']>('all'); const [state, setState] = useState<'' | 'open' | 'closed'>('');
  const q = useQuery({ queryKey: ['offers', box, state], queryFn: () => api<Page<Offer>>(`/offers?box=${box}&limit=50${state ? `&state=${state}` : ''}`), enabled: status === 'authed', refetchInterval: 30_000 });
  const sections = GROUPS.map((g) => ({ ...g, data: (q.data?.items ?? []).filter((o) => groupOf(o) === g.id) })).filter((g) => g.data.length);

  return (
    <SectionList
      sections={sections} keyExtractor={(o) => o.id} stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.ink} />}
      ListHeaderComponent={
        <View style={{ paddingTop: insets.top + 8, gap: 14, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <T v="display" style={{ flexShrink: 1 }}>Your <T v="accent" color={colors.cobaltInk}>offers</T></T>
            <BellButton />
          </View>
          <T color={colors.muted} style={{ marginTop: -8 }}>Everything you&apos;re negotiating, in one place.</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>{BOXES.map((b) => <Chip key={b.id} label={b.label} active={box === b.id} onPress={() => setBox(b.id)} />)}</View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: -6 }}>{([['', 'Any status'], ['open', 'Needs action / open'], ['closed', 'Closed']] as const).map(([v, l]) => (
            <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: state === v }} onPress={() => setState(v)} style={[s.mini, state === v && s.miniOn]}><T v="small" style={{ fontFamily: fonts.semibold, fontSize: 12 }} color={state === v ? colors.paper : colors.ink}>{l}</T></Pressable>
          ))}</View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14 }}>
          <T v="heading">{section.label}</T><View style={s.count}><T v="small" style={{ fontSize: 12 }} color={colors.muted}>{section.data.length}</T></View>
        </View>
      )}
      renderItem={({ item }) => <OfferRow o={item} me={user?.id} />}
      ListEmptyComponent={
        q.isPending ? <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 150 }} />)}</View>
          : q.isError ? <ErrorState onRetry={() => q.refetch()} />
            : <EmptyState icon={<Inbox size={28} color={colors.coralInk} />} title="No offers yet" body="Find something you love and propose a swap — your offers and the ones you receive show up here." action={<Button title="Discover items" onPress={() => router.navigate('/')} />} />
      }
    />
  );
}

function OfferRow({ o, me }: { o: Offer; me?: string }) {
  const side = mySide(o, me); const latest = o.revisions[o.revisions.length - 1]; const st = OFFER_STATUS[o.status];
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(`/offer/${o.id}`)} style={({ pressed }) => [s.card, o.yourTurn && { borderColor: colors.cobalt }, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Badge label={st.label} tone={st.tone} />
        {o.yourTurn ? <Badge label="Your turn" tone="cobalt" /> : null}
        {o.deal ? <Badge label="Deal" tone="mint" /> : null}
        <T v="small" color={colors.muted} style={{ marginLeft: 'auto' }}>{isOpen(o) ? timeLeft(o.expiresAt) : timeAgo(o.updatedAt)}</T>
      </View>
      <ProposalStrip give={side.give} get={side.get} cash={side.cash} cashFromYou={side.cashFromMe} otherName={side.other.displayName} light />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar name={side.other.displayName} url={side.other.avatarUrl} size={22} />
        <T v="small" color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>
          {o.sender.id === me ? `You offered to ${side.other.displayName}` : `${side.other.displayName} offered`} · v{latest.number}{latest.cashAmount > 0 ? ` · ${formatINR(latest.cashAmount)} cash` : ''}
        </T>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, padding: 12, gap: 10, ...shadow.card },
  mini: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center' },
  miniOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  count: { backgroundColor: colors.overlay, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
});
