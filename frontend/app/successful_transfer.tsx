import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SuccessfulTransfer({ amount: pAmount, username: pUser, phone_number: pPhone, reference: pRef }: any) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<any>();
  const amount = pAmount ?? params.amount;
  const username = pUser ?? params.username;
  const phone_number = pPhone ?? params.phone_number;
  const reference = pRef ?? params.reference;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Success" compact />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <GlassCard style={{ alignItems: 'center', paddingVertical: 30 }}>
          <View style={[styles.icon, { backgroundColor: t.successSoft }]}><Ionicons name="checkmark" size={38} color={t.success} /></View>
          <Text style={[styles.title, { color: t.text }]}>Transfer sent</Text>
          <Text style={{ color: t.textSecondary, textAlign: 'center', marginTop: 6 }}>Your money is on its way.</Text>
          <Text style={[styles.amount, { color: t.text }]}>K{amount}</Text>
          <View style={[styles.info, { backgroundColor: t.surfaceMuted }]}>
            {[['To', username], ['Phone', phone_number], ['Reference', reference]].filter(([,v]) => v).map(([k,v]) => (
              <View key={k as string} style={styles.row}><Text style={{ color: t.textSecondary }}>{k}</Text><Text style={{ color: t.text, fontWeight: '600' }}>{String(v)}</Text></View>
            ))}
          </View>
        </GlassCard>
        <AppButton label="Done" onPress={() => router.replace('/(tabs)')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, marginTop: -24 },
  icon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 18 },
  amount: { fontSize: 36, fontWeight: '700', letterSpacing: -1, marginTop: 14 },
  info: { width: '100%', borderRadius: 16, padding: 14, marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
});
