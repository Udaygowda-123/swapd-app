import { Redirect, router, Tabs } from 'expo-router';
import { Compass, Inbox, MessageCircle, Plus, User } from 'lucide-react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isBrowsing } from '@/lib/browse';
import { usePulse } from '@/lib/pulse';
import { colors, fonts, shadow } from '@/theme/tokens';

function Dot({ n }: { n?: number }) {
  if (!n) return null;
  return <View style={s.dot}><Text style={s.dotText}>{n > 9 ? '9+' : n}</Text></View>;
}

export default function TabsLayout() {
  const { status } = useAuth(); const pulse = usePulse();
  if (status === 'loading') return <Loading />;
  if (status === 'anon' && !isBrowsing()) return <Redirect href="/welcome" />;

  // Tabs that need an account open sign-in instead when browsing signed out.
  const gated = { tabPress: (e: { preventDefault: () => void }) => { if (status !== 'authed') { e.preventDefault(); router.push('/login'); } } };

  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, height: Platform.OS === 'ios' ? 88 : 68, paddingTop: 6 },
      sceneStyle: { backgroundColor: colors.paper },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Compass size={23} color={color} /> }} />
      <Tabs.Screen name="offers" listeners={gated} options={{ title: 'Offers', tabBarIcon: ({ color }) => <Inbox size={23} color={color} /> }} />
      <Tabs.Screen
        name="sell"
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push(status === 'authed' ? '/listing/new' : '/login'); } }}
        options={{ title: '', tabBarAccessibilityLabel: 'List an item', tabBarIcon: () => <View style={s.fab}><Plus size={26} color={colors.ink} strokeWidth={2.6} /></View> }}
      />
      <Tabs.Screen name="messages" listeners={gated} options={{ title: 'Messages', tabBarIcon: ({ color }) => <View><MessageCircle size={23} color={color} /><Dot n={pulse.data?.unreadConversations} /></View> }} />
      <Tabs.Screen name="me" listeners={gated} options={{ title: 'Me', tabBarIcon: ({ color }) => <View><User size={23} color={color} /><Dot n={pulse.data?.unreadNotifications} /></View> }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  fab: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 14, ...shadow.pop },
  dot: { position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  dotText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink },
});
