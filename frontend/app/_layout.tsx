import { getToken } from '@/components/auth/auth';
import LoadingScreen from '@/components/loading';
import { setupMarketplacePush } from '@/components/lib/push-setup';
import { ThemePreferenceProvider, useThemePreference } from '@/contexts/theme-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isReady } = useThemePreference();
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const loadToken = async () => {
      const token = await getToken();
      setUserToken(token);
      timeout = setTimeout(() => setIsLoading(false), 900);
    };
    loadToken();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (userToken) router.replace('/(tabs)');
    else router.replace('/onboarding1');
  }, [isLoading, userToken]);

  useEffect(() => {
    if (isLoading || !userToken) return;
    let cleanup: (() => void) | undefined;
    setupMarketplacePush()
      .then((remove) => { cleanup = remove; })
      .catch((error) => console.warn('Push setup failed', error));
    return () => cleanup?.();
  }, [isLoading, userToken]);

  const navTheme = colorScheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: Colors.dark.background,
          card: Colors.dark.surface,
          text: Colors.dark.text,
          border: Colors.dark.border,
          primary: Colors.dark.tint,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: Colors.light.background,
          card: Colors.light.surface,
          text: Colors.light.text,
          border: Colors.light.border,
          primary: Colors.light.tint,
        },
      };

  if (isLoading || !isReady) return <LoadingScreen />;

  return (
    <ThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors[colorScheme].background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootLayoutNav />
    </ThemePreferenceProvider>
  );
}
