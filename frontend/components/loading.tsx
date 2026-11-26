import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-theme-color';

export default function LoadingScreen() {
  const t = useAppTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.06, { duration: 1400 }), -1, true);
  }, [scale]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <LinearGradient colors={t.heroGradient as any} style={styles.container}>
      <View style={styles.glow} />
      <Animated.View entering={FadeIn.duration(500)} style={styles.brand}>
        <Animated.View style={[styles.iconCircle, aStyle]}>
          <Ionicons name="flash" size={34} color="#fff" />
        </Animated.View>
        <Text style={styles.logo}>Payreece</Text>
        <Text style={styles.tag}>Move money, beautifully.</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.footer}>
        <Text style={styles.footerText}>Securing your connection</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(10,132,255,0.16)', top: '20%' },
  brand: { alignItems: 'center' },
  iconCircle: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  logo: { fontSize: 34, fontWeight: '700', color: '#fff', letterSpacing: -0.8 },
  tag: { fontSize: 15, color: 'rgba(255,255,255,0.68)', marginTop: 8 },
  footer: { position: 'absolute', bottom: 56, alignItems: 'center' },
  footerText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.2 },
});
