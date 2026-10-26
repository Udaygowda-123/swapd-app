import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.paper, card: colors.paper, text: colors.ink, primary: colors.coral, border: colors.line } };

export default function RootLayout() {
  const [loaded, error] = useFonts({ BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, InstrumentSerif_400Regular_Italic, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 10 * 60_000, retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2 } },
  }));

  useEffect(() => { if (loaded || error) SplashScreen.hideAsync(); }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={theme}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
            <Stack.Screen name="register" options={{ presentation: 'modal' }} />
            <Stack.Screen name="forgot" options={{ presentation: 'modal' }} />
            <Stack.Screen name="listing/new" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
