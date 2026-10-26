import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellButton } from '@/components/bell-button';
import { Avatar, Button, EmptyState, ErrorState, Skeleton, T } from '@/components/ui';
import { absUrl, api } from '@/lib/api';
import { usePullRefresh } from '@/lib/use-pull-refresh';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { ConversationSummary } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

export default function Messages() {
  const insets = useSafeAreaInsets(); const { status } = useAuth();
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationSummary[]>('/conversations'), enabled: status === 'authed', refetchInterval: 15_000 });
  const pull = usePullRefresh(q.refetch);
  return (
    <FlatList
      data={q.data ?? []} keyExtractor={(c) => c.id}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 84 }} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.ink} />}
      ListHeaderComponent={<View style={{ paddingTop: insets.top + 4, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><T v="display"><T v="accent" color={colors.cobaltInk}>Messages</T></T><BellButton /></View>}
      renderItem={({ item: c }) => {
        const other = c.participants[0]; const unread = c.unreadCount > 0;
        return (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.overlay }]}>
            {unread ? <View style={s.marker} /> : null}
            <View>
              <Avatar name={other?.displayName ?? '?'} url={other?.avatarUrl} size={52} />
              {c.listing?.thumbUrl ? <Image source={absUrl(c.listing.thumbUrl)} style={s.thumb} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T v="strong" numberOfLines={1} style={{ flex: 1, fontFamily: unread ? fonts.bold : fonts.semibold }}>{other?.displayName ?? 'Unknown'}</T>
                <T v="small" color={colors.muted}>{c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</T>
              </View>
              <T v="small" color={colors.muted} numberOfLines={1}>re: {c.listing?.title ?? 'offer'}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T v="small" numberOfLines={1} color={unread ? colors.ink : colors.muted} style={{ flex: 1, fontFamily: unread ? fonts.semibold : fonts.body }}>
                  {c.lastMessage?.type === 'OFFER_CARD' ? '📦 Offer update' : c.lastMessage?.content ?? 'No messages yet'}
                </T>
                {unread ? <View style={s.badge}><T v="small" style={{ fontFamily: fonts.bold, fontSize: 11 }}>{c.unreadCount}</T></View> : null}
              </View>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        q.isPending ? <View style={{ gap: 10, paddingHorizontal: 20 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 72, borderRadius: 18 }} />)}</View>
          : q.isError ? <ErrorState onRetry={() => q.refetch()} />
            : <EmptyState icon={<MessageCircle size={28} color={colors.coralInk} />} title="No conversations yet" body="A chat opens automatically when you make or receive an offer." action={<Button title="Discover items" onPress={() => router.navigate('/')} />} />
      }
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  marker: { position: 'absolute', left: 6, top: 18, bottom: 18, width: 4, borderRadius: 2, backgroundColor: colors.cobaltInk },
  thumb: { position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.paper },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
});
