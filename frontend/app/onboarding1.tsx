import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';

export default function Onboarding() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={t.heroGradient as any} style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.glowA} /><View style={styles.glowB} />
      <Animated.Text entering={FadeIn.duration(500)} style={styles.brand}>Payreece</Animated.Text>

      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.center}>
        <View style={styles.avatars}>
          <Image source={require('../assets/images/avatars/avatar1.jpg')} style={[styles.avatar, styles.a1]} />
          <Image source={require('../assets/images/avatars/avatar3.jpg')} style={[styles.avatar, styles.a2]} />
          <Image source={require('../assets/images/avatars/avatar2.jpg')} style={[styles.avatar, styles.a3]} />
        </View>
        <Text style={styles.title}>Borderless transfers,{'\n'}made simple.</Text>
        <Text style={styles.sub}>Move money across borders instantly, securely, and with clarity.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.actions}>
        <AppButton label="Create account" onPress={() => router.push('/register')} style={{ width: '100%' }} />
        <AppButton label="Sign in" variant="secondary" onPress={() => router.push('/login')} style={{ width: '100%', backgroundColor: 'transparent' }} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  glowA: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -80 },
  glowB: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(10,132,255,0.18)', bottom: 120, left: -60 },
  brand: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  center: { alignItems: 'center' },
  avatars: { width: 260, height: 170, marginBottom: 32 },
  avatar: { width: 96, height: 96, borderRadius: 32, position: 'absolute', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  a1: { left: 10, top: 30, transform: [{ rotate: '-8deg' }] },
  a2: { left: 82, top: 0, width: 110, height: 110, borderRadius: 36, zIndex: 2 },
  a3: { right: 10, top: 30, transform: [{ rotate: '8deg' }] },
  title: { color: '#fff', fontSize: 38, fontWeight: '700', letterSpacing: -1, textAlign: 'center', lineHeight: 44 },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24, paddingHorizontal: 10 },
  actions: { gap: 12 },
});
