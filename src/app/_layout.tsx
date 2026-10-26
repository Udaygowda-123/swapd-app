import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { OfflineBanner } from '@/components/offline-banner';
import { AuthProvider } from '@/lib/auth';
import { PulseEffects } from '@/lib/pulse';
import { createQueryClient, setupQueryForMobile } from '@/lib/query';
import { ToastProvider } from '@/lib/toast';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
setupQueryForMobile();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.paper, card: colors.paper, text: colors.ink, primary: colors.coral, border: colors.line } };

export default function RootLayout() {
  const [loaded, error] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, InstrumentSerif_400Regular_Italic, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  const [qc] = useState(createQueryClient);

  useEffect(() => { if (loaded || error) SplashScreen.hideAsync(); }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={theme}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <PulseEffects />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="register" options={{ presentation: 'modal' }} />
            <Stack.Screen name="forgot" options={{ presentation: 'modal' }} />
            <Stack.Screen name="listing/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="listing/edit/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
          </Stack>
          <OfflineBanner />
        </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
