import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-theme-color';
import { GlassCard } from '@/components/ui/glass-card';

export default function TransactionProcessingCard({ amount, receiver, mobileNumber }: { amount: any; receiver: any; mobileNumber: any }) {
  const t = useAppTheme();
  return (
    <GlassCard style={{ marginTop: 24 }}>
      <View style={styles.header}>
        <ActivityIndicator size="small" color={t.tint} />
        <Text style={[styles.headerText, { color: t.text }]}>Processing transaction</Text>
      </View>
      <View style={[styles.sep, { backgroundColor: t.border }]} />
      {[
        ['Amount', `K ${amount}`],
        ['Recipient', String(receiver)],
        ['Phone', String(mobileNumber)],
      ].map(([k, v]) => (
        <View key={k} style={styles.row}>
          <Text style={[styles.label, { color: t.textSecondary }]}>{k}</Text>
          <Text style={[styles.value, { color: t.text }]}>{v}</Text>
        </View>
      ))}
      <Text style={[styles.note, { color: t.textMuted }]}>Please wait. This usually takes a few seconds.</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { fontSize: 17, fontWeight: '700' },
  sep: { height: 1, marginVertical: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
  note: { marginTop: 14, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
