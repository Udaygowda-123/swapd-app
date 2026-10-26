import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '@/theme/tokens';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; text: string }
interface ToastApi { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }
const Ctx = createContext<ToastApi | null>(null);

const ICON = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TINT = { success: colors.mint, error: colors.coral, info: colors.violet } as const;

/** Lightweight toasts (same role as the web app's): one at a time, newest wins, auto-dismiss, tap to close. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const [y] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(y, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setToast(null));
  }, [y]);
  const show = useCallback((kind: Kind, text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), kind, text });
    y.setValue(0);
    Animated.spring(y, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    timer.current = setTimeout(hide, kind === 'error' ? 4500 : 3000);
  }, [y, hide]);

  const api = useMemo<ToastApi>(() => ({ success: (t) => show('success', t), error: (t) => show('error', t), info: (t) => show('info', t) }), [show]);
  const I = toast ? ICON[toast.kind] : null;

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && I ? (
        <Animated.View pointerEvents="box-none" style={[s.wrap, { top: insets.top + 8, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }]}>
          <Pressable accessibilityRole="alert" accessibilityLiveRegion="polite" onPress={hide} style={s.toast}>
            <View style={[s.icon, { backgroundColor: TINT[toast.kind] }]}><I size={16} color={colors.ink} /></View>
            <Text style={s.text} numberOfLines={3}>{toast.text}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx); if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 480, width: '100%', backgroundColor: colors.ink, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, ...shadow.pop },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.paper },
});
