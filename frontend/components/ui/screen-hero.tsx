import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-theme-color';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
};

export function ScreenHero({ title, subtitle, onBack, right, children, compact }: Props) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={t.heroGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12, minHeight: compact ? 140 : 220 }]}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        ) : <View style={styles.iconBtnPlaceholder} />}
        {title ? <Text style={styles.title}>{title}</Text> : <View style={{ flex: 1 }} />}
        <View style={styles.right}>{right}</View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 36, overflow: 'hidden' },
  glowA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40 },
  glowB: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(10,132,255,0.18)', bottom: -40, left: -20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  iconBtnPlaceholder: { width: 38, height: 38 },
  right: { minWidth: 38, alignItems: 'flex-end' },
  title: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginTop: -4, marginBottom: 8, textAlign: 'center' },
});
