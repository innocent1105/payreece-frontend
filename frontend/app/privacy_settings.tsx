import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacySettings() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [publicProfile, setPublicProfile] = useState(false);
  const [biometric, setBiometric] = useState(true);
  const [activity, setActivity] = useState(true);

  const Row = ({ label, sub, value, onValueChange }: any) => (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: t.border, true: t.tint }} thumbColor="#fff" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Privacy" onBack={() => router.back()} compact />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <GlassCard style={{ padding: 6 }}>
          <Row label="Public profile" sub="Allow others to find you by username." value={publicProfile} onValueChange={setPublicProfile} />
          <Row label="Biometric unlock" sub="Use Face ID or fingerprint for sensitive actions." value={biometric} onValueChange={setBiometric} />
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Activity status</Text>
              <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 }}>Show when you were last active.</Text>
            </View>
            <Switch value={activity} onValueChange={setActivity} trackColor={{ false: t.border, true: t.tint }} thumbColor="#fff" />
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth } });
