import { Image } from 'expo-image';
import { ArrowLeftRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme/tokens';

// Same pairs as the web hero: each card flips to reveal what it's being swapped for.
const PAIRS = [
  { a: { src: require('../../assets/images/demo/sneakers-1.webp'), label: 'Sneakers' }, b: { src: require('../../assets/images/demo/headphones-1.webp'), label: 'Headphones' } },
  { a: { src: require('../../assets/images/demo/camera-0.webp'), label: 'Film camera' }, b: { src: require('../../assets/images/demo/vinyl-0.webp'), label: 'Sealed vinyl' } },
  { a: { src: require('../../assets/images/demo/console-1.webp'), label: 'Console' }, b: { src: require('../../assets/images/demo/jacket-1.webp'), label: 'Denim jacket' } },
];

function FlipCard({ pair, delay, tilt, lift }: { pair: (typeof PAIRS)[number]; delay: number; tilt: string; lift: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null; let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || !alive) return;
      const flip = (to: number) => Animated.timing(t, { toValue: to, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
      // rest on the item → flip to its swap → rest → flip forward again (always the same direction)
      loop = Animated.loop(Animated.sequence([Animated.delay(2200), flip(1), Animated.delay(2200), flip(2), Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true })]));
      setTimeout(() => alive && loop?.start(), delay);
    });
    return () => { alive = false; loop?.stop(); };
  }, [t, delay]);
  const front = t.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '180deg', '360deg'] });
  const back = t.interpolate({ inputRange: [0, 1, 2], outputRange: ['180deg', '360deg', '540deg'] });
  return (
    <View style={[s.cardWrap, { transform: [{ rotate: tilt }, { translateY: lift }] }]}>
      <Animated.View style={[s.face, s.front, { transform: [{ perspective: 900 }, { rotateY: front }] }]}>
        <Image source={pair.a.src} style={s.img} contentFit="cover" />
        <Text numberOfLines={1} style={s.cap}>{pair.a.label}</Text>
      </Animated.View>
      <Animated.View style={[s.face, s.back, { transform: [{ perspective: 900 }, { rotateY: back }] }]}>
        <Image source={pair.b.src} style={s.img} contentFit="cover" />
        <View style={s.capRow}><ArrowLeftRight size={11} color={colors.ink} strokeWidth={3} /><Text numberOfLines={1} style={[s.cap, { flex: 1 }]}>{pair.b.label}</Text></View>
      </Animated.View>
    </View>
  );
}

export function FlipDeck() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.row}>
      <FlipCard pair={PAIRS[0]} delay={0} tilt="-4deg" lift={0} />
      <FlipCard pair={PAIRS[1]} delay={1100} tilt="0deg" lift={-12} />
      <FlipCard pair={PAIRS[2]} delay={2200} tilt="4deg" lift={0} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 16 },
  cardWrap: { width: '30%', maxWidth: 150, aspectRatio: 0.66 },
  face: { position: 'absolute', inset: 0, borderRadius: 18, padding: 6, backfaceVisibility: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  front: { backgroundColor: '#FFFFFF' },
  back: { backgroundColor: colors.coral },
  img: { width: '100%', aspectRatio: 0.8, borderRadius: 13 },
  cap: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, paddingTop: 7, paddingHorizontal: 3 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 3 },
});
