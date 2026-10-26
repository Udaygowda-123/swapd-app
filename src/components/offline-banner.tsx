import { useNetInfo } from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme/tokens';

/** Shown only while the phone reports no connection; queries pause and resume on their own. */
export function OfflineBanner() {
  const net = useNetInfo(); const insets = useSafeAreaInsets();
  if (net.isConnected !== false) return null;
  return (
    <View accessibilityRole="alert" style={[s.bar, { paddingTop: insets.top + 6 }]}>
      <WifiOff size={15} color={colors.paper} /><Text style={s.text}>You&apos;re offline — we&apos;ll reconnect automatically.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 900, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8, backgroundColor: colors.ink },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.paper },
});
