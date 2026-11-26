import { getToken } from '@/components/auth/auth';
import LoadingScreen from '@/components/loading';
import { setupMarketplacePush } from '@/components/lib/push-setup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const loadToken = async () => {
      const token = await getToken();
      setUserToken(token);
      timeout = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    };

    loadToken();

    return () => clearTimeout(timeout);
  }, []);



  useEffect(() => {
    if (isLoading) return;

    if (userToken) {
      console.log('Logged In, redirecting to tabs');
      router.replace('/(tabs)');
    } else {
      console.log('Logged Out, redirecting to login');
      router.replace('/onboarding1');
    }
  }, [isLoading, userToken]);

  useEffect(() => {
    if (isLoading || !userToken) return;
    let cleanup: (() => void) | undefined;
    setupMarketplacePush()
      .then((remove) => {
        cleanup = remove;
      })
      .catch((error) => console.warn('Push setup failed', error));
    return () => cleanup?.();
  }, [isLoading, userToken]);

  if (isLoading) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" translucent={true} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <RootLayoutNav />;
}
