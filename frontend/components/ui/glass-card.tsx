import { BlurView } from 'expo-blur';

import React from 'react';
import { Platform, StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';

type Props = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  animated?: boolean;
  delay?: number;
};

export function GlassCard({ children, style, intensity = 40, animated = false, delay = 0 }: Props) {
  const t = useAppTheme();
  const flat = StyleSheet.flatten(style) || {};
  const radius = (flat.borderRadius as number) ?? Radius.lg;
  const content = (
    <View style={[styles.wrap, { borderRadius: radius, borderColor: t.glassBorder, shadowColor: t.cardShadow }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} tint={t.background === '#000000' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.glass }]} />
      <View style={[styles.highlight, { borderColor: t.glassHighlight, borderRadius: radius }]} pointerEvents="none" />
      <View style={styles.inner}>{children}</View>
    </View>
  );
  if (!animated) return content;
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(delay)}>
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  highlight: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    opacity: 0.35,
  },
  inner: {
    padding: 16,
  },
});
