import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Bell, CheckCheck } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHeader, Button, EmptyState, ErrorState, Loading, T } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { NotificationDto, Page } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

type P = Record<string, string | number | undefined>;

/** Same wording as the web notifications page, routed to the app's screens. */
function describe(n: NotificationDto): { text: string; href: Href } {
  const p = n.payload as P;
  const offer: Href = p.offerId ? `/offer/${p.offerId}` : '/offers'; const deal: Href = p.dealId ? `/deal/${p.dealId}` : '/deals';
  switch (n.type) {
    case 'MESSAGE': return { text: `${p.from ?? 'Someone'}: ${p.preview ?? 'sent a message'}`, href: p.conversationId ? `/chat/${p.conversationId}` : '/messages' };
    case 'OFFER_RECEIVED': return { text: 'You received a new offer', href: offer };
    case 'OFFER_COUNTERED': return { text: `You received a counteroffer (version ${p.revision})`, href: offer };
    case 'OFFER_ACCEPTED': return { text: 'Your offer was accepted — a deal was created', href: deal };
    case 'OFFER_REJECTED': return { text: p.reason ? 'An offer was closed because an item is no longer available' : 'An offer was declined', href: offer };
    case 'OFFER_WITHDRAWN': return { text: p.reason ? 'An offer was closed because an item is no longer available' : 'An offer was withdrawn', href: offer };
    case 'OFFER_CANCELLED': return { text: 'An offer was cancelled — an item in it is no longer available', href: offer };
    case 'OFFER_EXPIRED': return { text: 'An offer expired without a response', href: offer };
    case 'DEAL_UPDATED': return { text: ({ handover_confirmed: 'Your swap partner agreed to the handover plan', completion_requested: 'Your swap partner confirmed completion — your turn', completed: 'Swap complete! Leave a review', cancelled: 'A deal was cancelled', disputed: 'A dispute was opened on your deal' } as Record<string, string>)[String(p.event)] ?? 'A deal was updated', href: deal };
    case 'REVIEW_RECEIVED': return { text: `You received a ${p.rating}★ review`, href: '/me' };
    case 'MODERATION': return { text: ({ listing_removed: `Your listing “${p.title}” was removed by moderators`, listing_held: `Your listing “${p.title}” is under review`, listing_restored: `Your listing “${p.title}” was restored`, account_restricted: 'Your account was restricted', account_active: 'Your account restrictions were lifted', account_suspended: 'Your account was suspended', deal_resolved: 'Moderators resolved your disputed deal' } as Record<string, string>)[String(p.event)] ?? 'Moderation update', href: p.dealId ? deal : '/me' };
    default: return { text: 'Update', href: '/' };
  }
}

export default function Notifications() {
  const insets = useSafeAreaInsets(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<Page<NotificationDto> & { unreadCount: number }>('/notifications') });
  const done = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['pulse'] }); };
  const readOne = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: done });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: done });
  const unread = q.data?.unreadCount ?? 0;

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <BackHeader fallback="/me" right={unread ? <Button title="Mark all read" size="sm" variant="ghost" icon={<CheckCheck size={16} color={colors.ink} />} loading={readAll.isPending} onPress={() => readAll.mutate()} /> : undefined} />
      <FlatList
        data={q.data?.items ?? []} keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 32 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.ink} />}
        ListHeaderComponent={<View style={{ paddingBottom: 8 }}><T v="display">Notifications</T><T color={colors.muted}>{unread ? `${unread} unread` : "You're all caught up."}</T></View>}
        renderItem={({ item: n }) => {
          const d = describe(n);
          return (
            <Pressable accessibilityRole="link" onPress={() => { if (!n.readAt) readOne.mutate(n.id); router.push(d.href); }} style={({ pressed }) => [s.row, !n.readAt && s.unread, pressed && { opacity: 0.85 }]}>
              {!n.readAt ? <View style={s.dot} /> : null}
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: n.readAt ? fonts.body : fonts.semibold }}>{d.text}</T>
                <T v="small" color={colors.muted}>{timeAgo(n.createdAt)}</T>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={q.isPending ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <EmptyState icon={<Bell size={28} color={colors.coralInk} />} title="No notifications yet" body="Offers, messages and deal updates will show up here." />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  unread: { borderColor: colors.cobalt, backgroundColor: colors.cobaltSoft },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cobaltInk },
});
