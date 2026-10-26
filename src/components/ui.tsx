import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, CloudOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputInstance, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { absUrl } from '@/lib/api';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

/* ───────── Text ───────── */
const VARIANTS = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  // Sits inside a heading; a touch larger than the heading (serif reads smaller) but on the same line height so it's never clipped.
  accent: { fontFamily: fonts.accent, fontSize: 38, lineHeight: 40, letterSpacing: 0 },
} satisfies Record<string, TextStyle>;

export function T({ v = 'body', color, style, children, ...p }: TextProps & { v?: keyof typeof VARIANTS; color?: string }) {
  // Italic serif glyphs lean past their advance width; a thin trailing space keeps the last letter from being clipped.
  const content = v === 'accent' && typeof children === 'string' ? `${children}\u2009` : children;
  return <Text {...p} style={[VARIANTS[v], { color: color ?? colors.ink }, style]}>{content}</Text>;
}

/* ───────── Button ───────── */
type BtnVariant = 'primary' | 'ink' | 'outline' | 'ghost' | 'soft' | 'danger' | 'light';
const BTN: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.coral, fg: colors.ink },
  ink: { bg: colors.ink, fg: colors.paper },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.ink },
  soft: { bg: colors.overlay, fg: colors.ink },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  light: { bg: 'rgba(255,255,255,0.1)', fg: colors.paper, border: 'rgba(255,255,255,0.35)' }, // on dark media
};

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style }: {
  title: string; onPress?: () => void; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: React.ReactNode; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = BTN[variant]; const h = size === 'lg' ? 52 : size === 'sm' ? 36 : 46; const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off}
      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={({ pressed }) => [s.btn, { height: h, paddingHorizontal: size === 'sm' ? 14 : 22, backgroundColor: c.bg, borderColor: c.border ?? 'transparent', opacity: off ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, variant === 'primary' && shadow.card, style]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : icon}
      <Text style={{ fontFamily: fonts.bold, fontSize: size === 'sm' ? 14 : 16, color: c.fg }}>{title}</Text>
    </Pressable>
  );
}

/* ───────── Chip & Badge ───────── */
export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
      style={({ pressed }) => [s.chip, active ? { backgroundColor: colors.ink, borderColor: colors.ink } : null, pressed && { opacity: 0.8 }]}>
      {icon}<Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: active ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

const TONES = {
  neutral: [colors.overlay, colors.ink], coral: [colors.coralSoft, colors.coralInk], lilac: [colors.lilac, colors.lavenderInk],
  mint: [colors.mint, colors.mintInk], butter: [colors.butter, colors.butterInk], cobalt: [colors.cobaltInk, '#FFFFFF'],
  ink: [colors.ink, colors.paper], danger: [colors.dangerSoft, colors.danger],
} as const;
export type Tone = keyof typeof TONES;
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const [bg, fg] = TONES[tone];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: fg }}>{label}</Text></View>;
}

/* ───────── Avatar ───────── */
export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const src = absUrl(url);
  if (src) return <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, color: colors.mintInk }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

/* ───────── Card ───────── */
export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/* ───────── Back header (mirrors the web BackButton) ───────── */
export function BackHeader({ label = 'Back', fallback = '/', right, onPress }: { label?: string; fallback?: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <View style={s.backRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
        onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback as never)))}
        style={({ pressed }) => [s.back, pressed && { backgroundColor: colors.overlay }]}>
        <View style={s.backIcon}><ArrowLeft size={18} color={colors.ink} /></View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{label}</Text>
      </Pressable>
      {right}
    </View>
  );
}

/* ───────── Form field ───────── */
export const Field = forwardRef<TextInputInstance, TextInputProps & { label: string; error?: string; hint?: string }>(function Field({ label, error, hint, style, ...p }, ref) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="strong" style={{ fontSize: 14 }}>{label}</T>
      <TextInput ref={ref} placeholderTextColor={colors.muted} {...p}
        onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: colors.cobaltInk, borderWidth: 2 }, error ? { borderColor: colors.danger } : null, p.multiline && { height: 110, paddingTop: 12, textAlignVertical: 'top' }, style]} />
      {error ? <T v="small" color={colors.danger}>{error}</T> : hint ? <T v="small" color={colors.muted}>{hint}</T> : null}
    </View>
  );
});

/* ───────── States ───────── */
export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>{icon}</View>
      <T v="heading" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T color={colors.muted} style={{ textAlign: 'center', maxWidth: 300 }}>{body}</T> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <EmptyState icon={<CloudOff size={28} color={colors.coralInk} />} title="Something went wrong" body={message ?? "We couldn't load this. Check your connection and try again."} action={onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : undefined} />;
}

export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }, style]}><ActivityIndicator color={colors.ink} /></View>;
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: '#EFEBE4', borderRadius: radius.card }, style]} />;
}

export const PressableCard = (p: PressableProps & { style?: StyleProp<ViewStyle> }) => (
  <Pressable {...p} style={({ pressed }) => [p.style, pressed && { transform: [{ scale: 0.985 }], opacity: 0.96 }]} />
);

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 16, ...shadow.card },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, height: 42, borderRadius: radius.pill },
  backIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  input: { height: 48, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
