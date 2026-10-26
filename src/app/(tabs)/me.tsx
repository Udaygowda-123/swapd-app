import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bell, ChevronRight, Handshake, Heart, LogOut, MailCheck, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileHeader, UserListings } from '@/components/profile';
import { Button, ErrorState, Loading, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm, notify } from '@/lib/confirm';
import { usePulse } from '@/lib/pulse';
import type { PublicProfile } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

export default function Me() {
  const insets = useSafeAreaInsets(); const { user, logout } = useAuth(); const pulse = usePulse();
  const q = useQuery({ queryKey: ['profile', user?.id], queryFn: () => api<PublicProfile>(`/users/${user!.id}`), enabled: !!user });
  const [sending, setSending] = useState(false);

  if (!user) return <Loading />;
  async function resend() {
    setSending(true);
    try { await api('/auth/resend-verification', { method: 'POST' }); notify('Email sent', `We sent a new verification link to ${user!.email}.`); }
    catch (e) { notify('Could not send', e instanceof ApiError ? e.message : 'Try again in a minute.'); } finally { setSending(false); }
  }
  async function signOut() { if (await confirm('Sign out?', 'You can sign back in any time.', 'Sign out')) { await logout(); router.replace('/welcome'); } }

  const rows = [
    { icon: Heart, label: 'Saved items', href: '/saved' as const },
    { icon: Bell, label: 'Notifications', href: '/notifications' as const, count: pulse.data?.unreadNotifications },
    { icon: Handshake, label: 'My deals', href: '/deals' as const },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 40, gap: 18 }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.ink} />}>
      {!user.emailVerifiedAt ? (
        <View style={s.verify}>
          <MailCheck size={18} color={colors.butterInk} />
          <T v="small" color={colors.butterInk} style={{ flex: 1 }}>Verify your email to build trust — we sent a link to <T v="small" color={colors.butterInk} style={{ fontFamily: fonts.bold }}>{user.email}</T>.</T>
          <Pressable accessibilityRole="button" onPress={resend} disabled={sending}><T v="small" color={colors.butterInk} style={{ fontFamily: fonts.bold, textDecorationLine: 'underline' }}>{sending ? 'Sending…' : 'Resend'}</T></Pressable>
        </View>
      ) : null}

      {q.isPending ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <ProfileHeader p={q.data} />}

      <View style={s.menu}>
        {rows.map((r, i) => (
          <Pressable key={r.href} accessibilityRole="link" onPress={() => router.push(r.href)} style={({ pressed }) => [s.row, i > 0 && s.divider, pressed && { backgroundColor: colors.overlay }]}>
            <View style={s.rowIcon}><r.icon size={18} color={colors.ink} /></View>
            <T v="strong" style={{ flex: 1 }}>{r.label}</T>
            {r.count ? <View style={s.count}><T v="small" style={{ fontFamily: fonts.bold, fontSize: 12 }}>{r.count}</T></View> : null}
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <T v="title">My listings</T>
        <Button title="List an item" size="sm" icon={<Plus size={16} color={colors.ink} />} onPress={() => router.push('/listing/new')} />
      </View>
      <UserListings userId={user.id} own />

      <Button title="Sign out" variant="outline" icon={<LogOut size={16} color={colors.ink} />} onPress={signOut} style={{ marginTop: 10 }} />
      <T v="small" color={colors.muted} style={{ textAlign: 'center' }}>Edit your profile and password on the SWAPD website.</T>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  verify: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.butter, borderRadius: 16, padding: 14 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 58 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
});
