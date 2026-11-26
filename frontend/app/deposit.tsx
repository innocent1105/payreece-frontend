import { ScreenHero } from '@/components/ui/screen-hero';
import { GlassCard } from '@/components/ui/glass-card';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DepositScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Deposit" onBack={() => router.back()} compact />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ color: t.textSecondary, fontSize: 14 }}>Quick deposit</Text>
          <Text style={{ color: t.text, fontSize: 34, fontWeight: '700', marginTop: 8 }}>Mobile money</Text>
          <Text style={{ color: t.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>Use the modern deposit flow for real mobile money top-ups.</Text>
          <AppButton label="Go to deposit" onPress={() => router.replace('/deposit_funds')} style={{ width: '100%', marginTop: 20 }} />
        </GlassCard>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ body: { padding: 20, marginTop: -24 } });
