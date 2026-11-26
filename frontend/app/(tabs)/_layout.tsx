import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme-color';

type TabRoute = { key: string; name: string };

type TabEvent = { defaultPrevented?: boolean };

type TabBarProps = {
  state: { routes: TabRoute[]; index: number };
  descriptors: Record<string, { options: { title?: string } }>;
  emitter?: { emit: (event: Record<string, unknown>) => TabEvent };
  navigateToTab?: (key: string) => void;
  navigation?: { emit?: (event: Record<string, unknown>) => TabEvent; navigate?: (name: string) => void };
};

function CustomTabBar({ state, descriptors, emitter, navigateToTab, navigation }: TabBarProps) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();

  const handlePress = (route: TabRoute, isFocused: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const event = emitter?.emit?.({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    }) ?? navigation?.emit?.({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (isFocused || event?.defaultPrevented) return;
    if (navigateToTab) navigateToTab(route.key);
    else navigation?.navigate?.(route.name);
  };

  const iconFor = (name: string, isFocused: boolean): keyof typeof Ionicons.glyphMap => {
    if (name === 'index') return isFocused ? 'home' : 'home-outline';
    if (name === 'account') return isFocused ? 'person' : 'person-outline';
    return isFocused ? 'swap-vertical' : 'swap-vertical-outline';
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: t.tabBar, borderColor: t.glassBorder, shadowColor: t.cardShadow }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={70} tint={t.background === '#000000' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.rounded]} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.rounded, { backgroundColor: t.tabBar }]} />
        <View style={[styles.highlight, { backgroundColor: t.glassHighlight }]} />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = descriptors[route.key]?.options?.title ?? (route.name === 'index' ? 'Home' : route.name);
          const color = isFocused ? t.tabIconSelected : t.tabIconDefault;

          if (route.name === 'explore') {
            return (
              <Pressable
                key={route.key}
                onPress={() => handlePress(route, isFocused)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: isFocused }}
                style={({ pressed }) => [styles.centerItem, pressed && styles.pressed]}
              >
                <View style={[styles.centerRing, { borderColor: t.background }]}>
                  <LinearGradient colors={[t.tint, t.accentSoft]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.centerButton}>
                    <Ionicons name="add" size={28} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={[styles.centerLabel, { color: isFocused ? t.tint : t.textMuted }]}>Pay</Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={() => handlePress(route, isFocused)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.iconBox, isFocused && { backgroundColor: t.accentSoftBg }]}>
                <Ionicons name={iconFor(route.name, isFocused)} size={22} color={color} />
              </View>
              <Text style={[styles.label, { color }]}>{label}</Text>
              <View style={[styles.indicator, isFocused && { backgroundColor: t.tint }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...(props as unknown as TabBarProps)} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Pay' }} />
      <Tabs.Screen name="account" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
  },
  bar: {
    height: 72,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 14,
  },
  rounded: { borderRadius: Radius.xl },
  highlight: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    opacity: 0.65,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  iconBox: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  centerItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -30,
  },
  centerRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 10,
  },
  centerButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  pressed: { opacity: 0.65 },
});
