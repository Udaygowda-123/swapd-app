import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { usePulse } from '@/lib/pulse';
import { colors, fonts } from '@/theme/tokens';

/** Notifications entry point with the unread count (same pulse data as the tab badges). Hidden when signed out. */
export function BellButton() {
  const { status } = useAuth(); const pulse = usePulse(); const n = pulse.data?.unreadNotifications ?? 0;
  if (status !== 'authed') return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={n ? `Notifications, ${n} unread` : 'Notifications'} hitSlop={6} onPress={() => router.push('/notifications')}
      style={({ pressed }) => [s.btn, pressed && { backgroundColor: colors.overlay }]}>
      <Bell size={21} color={colors.ink} />
      {n ? <View style={s.dot}><Text style={s.dotText}>{n > 9 ? '9+' : n}</Text></View> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  dotText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink },
});
