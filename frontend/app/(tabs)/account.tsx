import { BASE_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-theme-color';
import { useThemePreference, type ThemePreference } from '@/contexts/theme-preference';
import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { Radius } from '@/constants/theme';

type RowProps = { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; danger?: boolean };
const Row = ({ icon, label, value, onPress, danger }: RowProps) => {
  const t = useAppTheme();
  return (
    <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? t.dangerSoft : t.accentSoftBg }]}>
        <Ionicons name={icon} size={18} color={danger ? t.danger : t.tint} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? t.danger : t.text }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: t.textSecondary }]}>{value}</Text> : null}
      {!value ? <Ionicons name="chevron-forward" size={18} color={t.textMuted} /> : null}
    </Pressable>
  );
};

const ThemeSelector = () => {
  const t = useAppTheme();
  const { preference, setPreference } = useThemePreference();
  const opts: { key: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];
  return (
    <View style={[styles.segment, { backgroundColor: t.inputBg, borderColor: t.border }]}>
      {opts.map((o) => {
        const active = preference === o.key;
        return (
          <Pressable key={o.key} onPress={() => setPreference(o.key)} style={[styles.segmentBtn, active && { backgroundColor: t.surface, shadowColor: t.cardShadow }]}>
            <Ionicons name={o.icon} size={16} color={active ? t.tint : t.textMuted} />
            <Text style={[styles.segmentLabel, { color: active ? t.text : t.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default function AccountScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { preference } = useThemePreference();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('dashboard_data');
        if (stored) setProfile(JSON.parse(stored)?.data ?? null);
      } catch {}
    })();
  }, []);

  const themeLabel = preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light';

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar style={t.background === '#000000' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <ScreenHero title="Account" compact>
          <Animated.View entering={FadeInDown.duration(380)} style={styles.profileBlock}>
            <Image source={{ uri: `${BASE_URL}/view_pp.php?file=${profile?.avatar || 'avatar1.jpg'}` }} style={[styles.avatar, { borderColor: 'rgba(255,255,255,0.3)' }]} />
            <Text style={styles.name}>{profile?.full_name || 'Your account'}</Text>
            <Text style={styles.handle}>@{profile?.username || 'payreece'}</Text>
            <Pressable onPress={() => router.push('/edit_profile')} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit profile</Text>
            </Pressable>
          </Animated.View>
        </ScreenHero>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(60).duration(380)}>
            <GlassCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: t.textSecondary }]}>Appearance</Text>
              <Text style={[styles.cardSub, { color: t.textMuted }]}>Choose how Payreece looks. System follows your device setting.</Text>
              <ThemeSelector />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(380)}>
            <GlassCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: t.textSecondary }]}>Payment</Text>
              <Row icon="card-outline" label="Payment methods" onPress={() => router.push('/payment_methods')} />
              <View style={[styles.divider, { backgroundColor: t.border }]} />
              <Row icon="shield-checkmark-outline" label="Privacy settings" onPress={() => router.push('/privacy_settings')} />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(380)}>
            <GlassCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: t.textSecondary }]}>Preferences</Text>
              <Row icon="color-palette-outline" label="Theme" value={themeLabel} />
              <View style={[styles.divider, { backgroundColor: t.border }]} />
              <Row icon="notifications-outline" label="Notifications" value="On" />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(380)}>
            <GlassCard style={styles.card}>
              <Text style={[styles.cardTitle, { color: t.textSecondary }]}>Session</Text>
              <Row
                icon="log-out-outline"
                label="Log out"
                danger
                onPress={async () => {
                  try {
                    await SecureStore.deleteItemAsync('token');
                    await SecureStore.deleteItemAsync('dashboard_data');
                    await SecureStore.deleteItemAsync('payper-token');
                    await SecureStore.deleteItemAsync('p-transactions');
                    await AsyncStorage.clear();
                  } catch {}
                  router.replace('/login');
                }}
              />
            </GlassCard>
          </Animated.View>

          <Text style={[styles.footer, { color: t.textMuted }]}>Payreece</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileBlock: { alignItems: 'center', marginTop: 6, paddingBottom: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, marginBottom: 12 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  handle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2, marginBottom: 14 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  editBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  body: { padding: 20, gap: 14, marginTop: -12 },
  card: { padding: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, paddingHorizontal: 8, paddingTop: 8 },
  cardSub: { fontSize: 13, lineHeight: 18, paddingHorizontal: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  rowValue: { fontSize: 15, marginRight: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 54 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.md, borderWidth: 1, marginHorizontal: 8, marginBottom: 8 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 8 },
});
