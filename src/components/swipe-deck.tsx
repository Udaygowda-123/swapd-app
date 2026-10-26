import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeftRight, Eye, Heart, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { coverOf } from '@/components/listing-card';
import { T } from '@/components/ui';
import { absUrl, api } from '@/lib/api';
import { useRequireAccount } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { CONDITION_LABELS } from '@/lib/shared';
import { useToast } from '@/lib/toast';
import type { Listing } from '@/lib/types';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

const THRESHOLD = 110;

/**
 * Swipe mode (same behaviour as the web deck): drag right = Save, left = Skip. Every gesture also has a labelled
 * button. The drag runs on the UI thread (Reanimated), and the next card's photos are prefetched.
 */
export function SwipeDeck({ items, hasMore, onNeedMore, onDecided }: { items: Listing[]; hasMore: boolean; onNeedMore: () => void; onDecided: (id: string) => void }) {
  const requireAccount = useRequireAccount(); const toast = useToast();
  const [index, setIndex] = useState(0); const [photo, setPhoto] = useState(0); const [busy, setBusy] = useState(false);
  const x = useSharedValue(0);
  // Size the card to the screen so the card and its buttons fit above the tab bar (header + buttons + tabs ≈ 470pt).
  const { height } = useWindowDimensions(); const cardW = Math.max(220, Math.min(420, (height - 470) * 0.78));
  const current = items[index]; const next = items[index + 1];

  useEffect(() => { if (hasMore && items.length - index <= 3) onNeedMore(); }, [index, items.length, hasMore, onNeedMore]);
  useEffect(() => { // warm the next two cards' photos so they appear instantly
    const urls = items.slice(index + 1, index + 3).flatMap((l) => l.images.slice(0, 3).map((i) => absUrl(i.url))).filter((u): u is string => !!u);
    if (urls.length) Image.prefetch(urls).catch(() => undefined);
  }, [index, items]);

  function advance() { x.value = 0; setPhoto(0); setIndex((i) => i + 1); setBusy(false); }

  async function decide(kind: 'save' | 'skip') {
    if (!current || busy) return;
    if (!requireAccount()) { x.value = withSpring(0); return; }
    setBusy(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(kind === 'save' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const l = current;
    x.value = withTiming(kind === 'save' ? 700 : -700, { duration: 220 }, () => scheduleOnRN(advance));
    try { await api(`/listings/${l.id}/${kind === 'save' ? 'favorite' : 'dismiss'}`, { method: 'POST' }); onDecided(l.id); if (kind === 'save') toast.success(`Saved ${l.title}`); }
    catch { toast.error('Could not record that — try again'); }
  }

  const pan = usePanGesture({
    activeOffsetX: [-12, 12], failOffsetY: [-24, 24],
    onUpdate: (e) => { 'worklet'; x.value = e.translationX; },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX > THRESHOLD) scheduleOnRN(decide, 'save');
      else if (e.translationX < -THRESHOLD) scheduleOnRN(decide, 'skip');
      else x.value = withSpring(0, { damping: 18, stiffness: 220 });
    },
  });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: `${interpolate(x.value, [-220, 220], [-12, 12])}deg` }] }));
  const saveStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, THRESHOLD], [0, 1], 'clamp') }));
  const skipStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-THRESHOLD, -20], [1, 0], 'clamp') }));
  const nextStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(Math.abs(x.value), [0, THRESHOLD], [0.94, 1], 'clamp') }] }));

  if (!current) return (
    <View style={{ alignItems: 'center', paddingVertical: 60, gap: 6 }}>
      <T v="title" style={{ fontSize: 22 }}>{hasMore ? 'Loading more…' : "You're all caught up"}</T>
      {!hasMore ? <T color={colors.muted} style={{ textAlign: 'center' }}>Switch to grid view or adjust your filters to see more.</T> : null}
    </View>
  );

  const img = current.images[photo] ?? current.images[0]; const n = current.images.length;
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={[s.stage, { width: cardW }]}>
        {next ? <Animated.View style={[s.card, s.under, nextStyle]}><Image source={coverOf(next)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /></Animated.View> : null}
        <GestureDetector gesture={pan}>
          <Animated.View key={current.id} style={[s.card, shadow.pop, cardStyle]}>
            <Image source={absUrl(img?.url)} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} cachePolicy="memory-disk" accessibilityLabel={img?.altText ?? current.title} />
            {n > 1 ? (
              <>
                <View style={s.bars}>{current.images.map((im, i) => <View key={im.id} style={[s.bar, i <= photo && s.barOn]} />)}</View>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" style={[s.tap, { left: 0 }]} onPress={() => setPhoto((p) => Math.max(0, p - 1))} />
                <Pressable accessibilityRole="button" accessibilityLabel="Next photo" style={[s.tap, { right: 0 }]} onPress={() => setPhoto((p) => Math.min(n - 1, p + 1))} />
              </>
            ) : null}
            <Animated.Text style={[s.stamp, s.save, saveStyle]}>SAVE</Animated.Text>
            <Animated.Text style={[s.stamp, s.skip, skipStyle]}>SKIP</Animated.Text>
            <LinearGradient colors={['transparent', 'rgba(23,21,30,0.88)']} style={s.info} pointerEvents="none">
              <Text style={s.title} numberOfLines={2}>{current.title}</Text>
              <Text style={s.meta} numberOfLines={1}>{CONDITION_LABELS[current.condition]} · ~{formatINR(current.estimatedValue)} · {current.locationCity ?? 'Location not shared'}</Text>
              <Text style={s.by} numberOfLines={1}>by {current.owner.displayName}{current.wantedText ? ` · wants ${current.wantedText}` : ''}</Text>
              {current.match?.reasons[0] ? <Text style={s.match} numberOfLines={1}>✦ {current.match.reasons[0]}</Text> : null}
            </LinearGradient>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={s.buttons}>
        <Round label="Skip" size={60} onPress={() => decide('skip')} bg={colors.surface} border><X size={26} color={colors.coralInk} /></Round>
        <Round label="View details" size={48} onPress={() => router.push(`/listing/${current.id}`)} bg={colors.overlay}><Eye size={20} color={colors.ink} /></Round>
        <Round label="Make an offer" size={48} onPress={() => requireAccount() && router.push(`/swap/${current.id}`)} bg={colors.ink}><ArrowLeftRight size={20} color={colors.paper} /></Round>
        <Round label="Save" size={60} onPress={() => decide('save')} bg={colors.coral}><Heart size={26} color={colors.ink} /></Round>
      </View>
      <T v="small" color={colors.muted} style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>Drag the card or use the buttons · tap photo edges to browse</T>
    </View>
  );
}

function Round({ label, size, bg, border, onPress, children }: { label: string; size: number; bg: string; border?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] }, border && { borderWidth: 1, borderColor: colors.line }, shadow.card]}>
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  stage: { aspectRatio: 0.78, alignSelf: 'center' },
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#EFEBE4' },
  under: { opacity: 0.75 },
  bars: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(250,248,245,0.4)' },
  barOn: { backgroundColor: colors.paper },
  tap: { position: 'absolute', top: 60, bottom: 140, width: '35%' },
  stamp: { position: 'absolute', top: 28, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 4, borderRadius: 12, fontFamily: fonts.display, fontSize: 24, overflow: 'hidden' },
  save: { left: 20, transform: [{ rotate: '-10deg' }], borderColor: colors.mint, backgroundColor: 'rgba(216,244,223,0.92)', color: colors.mintInk },
  skip: { right: 20, transform: [{ rotate: '10deg' }], borderColor: colors.coral, backgroundColor: 'rgba(255,227,220,0.92)', color: colors.coralInk },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 80 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: colors.paper, letterSpacing: -0.5 },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(250,248,245,0.88)', marginTop: 6 },
  by: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(250,248,245,0.72)', marginTop: 2 },
  match: { alignSelf: 'flex-start', marginTop: 8, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.lilac, color: colors.lavenderInk, fontFamily: fonts.bold, fontSize: 12, paddingHorizontal: 10, paddingVertical: 4 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
});
