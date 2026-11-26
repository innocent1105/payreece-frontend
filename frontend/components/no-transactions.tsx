import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-theme-color';
import { AppButton } from '@/components/ui/app-button';
import { Radius } from '@/constants/theme';

const NoTransactions = ({ onDepositPress }: { onDepositPress?: () => void }) => {
  const t = useAppTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: t.accentSoftBg, borderColor: t.border }]}>
        <Ionicons name="wallet-outline" size={42} color={t.tint} />
      </View>
      <Text style={[styles.title, { color: t.text }]}>No transactions yet</Text>
      <Text style={[styles.description, { color: t.textSecondary }]}>Your activity will show up here after your first deposit or transfer.</Text>
      {onDepositPress ? <AppButton label="Add money" onPress={onDepositPress} style={{ width: '100%', maxWidth: 260 }} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, letterSpacing: -0.3 },
  description: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
});

export default NoTransactions;
