import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReceiveScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const accountId = 'PZ-2025-5678';
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Receive" subtitle="Share your account to get paid" onBack={() => router.back()} />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View style={[styles.qr, { backgroundColor: t.surfaceMuted, borderColor: t.border }]}>
            <Ionicons name="qr-code-outline" size={120} color={t.text} />
          </View>
          <Text style={{ color: t.textSecondary, marginTop: 16, textAlign: 'center' }}>Scan to send money to this account.</Text>
        </GlassCard>
        <GlassCard>
          {[['Account ID', accountId], ['Type', 'Personal Wallet'], ['Status', 'Verified']].map(([k, v], i, arr) => (
            <View key={k} style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
              <Text style={{ color: t.textSecondary }}>{k}</Text>
              <Text style={{ color: t.text, fontWeight: '600' }}>{v}</Text>
            </View>
          ))}
        </GlassCard>
        <AppButton label="Share details" onPress={() => Share.share({ message: `Pay me on Payreece. Account ID: ${accountId}` })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, marginTop: -24 },
  qr: { width: 190, height: 190, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
});
