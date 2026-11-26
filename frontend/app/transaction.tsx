import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TransactionDetail() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const item: any = useLocalSearchParams();

  const amount = parseFloat(item.amount || '0');
  const fee = amount * 0.015;
  const total = amount + fee;
  const isDeposit = item.type === 'deposit';

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Receipt" onBack={() => router.back()} compact right={<Ionicons name="share-outline" size={22} color="#fff" onPress={() => Share.share({ message: `Payreece receipt: K${amount.toFixed(2)}` })} />} />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View style={[styles.statusIcon, { backgroundColor: t.successSoft }]}><Ionicons name="checkmark" size={30} color={t.success} /></View>
          <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 12 }}>{isDeposit ? 'Deposit successful' : 'Payment successful'}</Text>
          <Text style={{ color: t.text, fontSize: 40, fontWeight: '700', letterSpacing: -1, marginTop: 6 }}>K{amount.toFixed(2)}</Text>
        </GlassCard>

        <GlassCard>
          {[
            ['Type', item.type || '-'],
            ['From/To', item.other_sender_name || item.username || '-'],
            ['Date', item.date ? new Date(item.date).toLocaleString() : '-'],
            ['Fee', `K${fee.toFixed(2)}`],
            ['Total', `K${total.toFixed(2)}`],
          ].map(([k, v], i, arr) => (
            <View key={k} style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
              <Text style={{ color: t.textSecondary }}>{k}</Text>
              <Text style={{ color: t.text, fontWeight: k === 'Total' ? '700' : '500' }}>{v}</Text>
            </View>
          ))}
        </GlassCard>
        <AppButton label="Back to home" onPress={() => router.replace('/(tabs)')} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, marginTop: -24 },
  statusIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
});
