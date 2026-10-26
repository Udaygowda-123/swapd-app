import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import type { Me } from '@/lib/types';
import { colors } from '@/theme/tokens';

/** Shared frame for sign-in / sign-up / reset: close button, editorial heading, keyboard-safe scroll. */
export function AuthScreen({ title, accent, subtitle, children }: { title: string; accent?: string; subtitle?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} style={s.close}><X size={20} color={colors.ink} /></Pressable>
        <T v="title" style={{ fontSize: 34, lineHeight: 40, marginTop: 20 }}>{title}{accent ? <T v="accent" color={colors.cobaltInk}>{` ${accent}`}</T> : null}</T>
        {subtitle ? <T color={colors.muted} style={{ marginTop: 6 }}>{subtitle}</T> : null}
        <View style={{ gap: 16, marginTop: 28 }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <View accessibilityRole="alert" style={s.err}><T v="small" color={colors.danger} style={{ fontFamily: 'Geist_600SemiBold' }}>{message}</T></View>;
}

/** After signing in: drop the auth modals, then onboarding for new accounts (same rule as the web) or the tabs. */
export function enterApp(me?: Me | null) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(me && !me.preference?.onboardedAt ? '/onboarding' : '/');
}

const s = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  err: { backgroundColor: colors.dangerSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
});
