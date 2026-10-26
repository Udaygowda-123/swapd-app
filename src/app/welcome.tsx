import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeftRight, BadgeCheck, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlipDeck } from '@/components/flip-deck';
import { Button } from '@/components/ui';
import { startBrowsing } from '@/lib/browse';
import { colors, fonts } from '@/theme/tokens';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Image source={require('../../assets/images/hero-poster.webp')} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(16,14,22,0.92)', 'rgba(16,14,22,0.82)', 'rgba(16,14,22,0.97)']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }} bounces={false}>
        <View style={s.logoRow}>
          <View style={s.logo}><ArrowLeftRight size={16} color={colors.ink} strokeWidth={3} /></View>
          <Text style={s.logoText}>swapd</Text>
        </View>

        <View style={s.badge}><Sparkles size={15} color={colors.violet} /><Text style={s.badgeText}>Swap, don&apos;t shop</Text></View>
        <Text style={s.h1}>Your next <Text style={s.accent}>favourite</Text> thing is already <Text style={s.underline}>out there.</Text></Text>
        <Text style={s.sub}>Trade item for item, bundle a few together, or even things out with a negotiated cash difference. Real photos, clear terms, both-sides confirmation.</Text>

        <FlipDeck />
        <View style={s.stickers}>
          <Text style={[s.sticker, { backgroundColor: colors.mint, color: colors.mintInk, transform: [{ rotate: '-3deg' }] }]}>+ ₹1,000</Text>
          <Text style={[s.sticker, { backgroundColor: colors.lilac, color: colors.lavenderInk, transform: [{ rotate: '2deg' }] }]}>Offer accepted ✓</Text>
        </View>

        <View style={{ gap: 12, marginTop: 28 }}>
          <Button title="Start swapping" size="lg" onPress={() => router.push('/register')} />
          <Button title="I already have an account" size="lg" variant="light" onPress={() => router.push('/login')} />
          <Pressable accessibilityRole="button" onPress={() => { startBrowsing(); router.replace('/'); }} hitSlop={10} style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Text style={s.browse}>Just browse first</Text>
          </Pressable>
        </View>

        <View style={s.trust}>
          {['Free to use', 'No payments handled', 'Originals always kept'].map((t) => (
            <View key={t} style={s.trustItem}><BadgeCheck size={15} color={colors.mint} /><Text style={s.trustText}>{t}</Text></View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  logo: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.display, fontSize: 22, color: colors.paper, letterSpacing: -0.6 },
  badge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.violet },
  h1: { fontFamily: fonts.display, fontSize: 42, lineHeight: 43, letterSpacing: -1.1, color: colors.paper, marginTop: 20 },
  accent: { fontFamily: fonts.accent, fontSize: 46, color: colors.violet, letterSpacing: 0 },
  underline: { textDecorationLine: 'underline', textDecorationColor: colors.coral },
  sub: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: 'rgba(250,248,245,0.8)', marginTop: 16 },
  stickers: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 22 },
  sticker: { fontFamily: fonts.display, fontSize: 14, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, overflow: 'hidden' },
  browse: { fontFamily: fonts.semibold, fontSize: 15, color: 'rgba(250,248,245,0.75)', textDecorationLine: 'underline' },
  trust: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 8, marginTop: 24 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(250,248,245,0.75)' },
});
