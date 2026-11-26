import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import TransactionProcessingCard from '@/components/paymentProcessing';
import { ScreenHero } from '@/components/ui/screen-hero';
import { GlassCard } from '@/components/ui/glass-card';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SendScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id, username, phone_number, amount } = useLocalSearchParams<any>();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const amt = parseFloat(amount || '0');
  const fee = amt * 0.015;
  const total = amt + fee;

  useEffect(() => { getToken().then(setToken); }, []);

  const sendFunds = async () => {
    setProcessing(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/send_to_user.php`, {
        sender_id: token, receiver_id: id, username, phone_number, amount, password, selectedNetwork: 'MTN'
      }, { timeout: 10000 });
      if (res.data?.success) {
        router.push({ pathname: '/successful_transfer', params: { amount, username, phone_number, reference: res.data.reference } });
      } else setError(res.data?.message || 'Transfer failed.');
    } catch { setError('Failed, please try again later.'); }
    finally { setProcessing(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <ScreenHero title="Confirm" subtitle="Review and authorize transfer" onBack={() => router.back()} />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(380)}>
            {processing ? (
              <TransactionProcessingCard amount={amount} receiver={username} mobileNumber={phone_number} />
            ) : (
              <GlassCard>
                <Text style={[styles.section, { color: t.textSecondary }]}>Transfer details</Text>
                {[['Recipient', username], ['Phone', phone_number], ['Amount', `K${amt.toFixed(2)}`], ['Fee (1.5%)', `K${fee.toFixed(2)}`]].map(([k, v]) => (
                  <View key={k as string} style={styles.row}><Text style={{ color: t.textSecondary }}>{k}</Text><Text style={{ color: t.text, fontWeight: '600' }}>{v as string}</Text></View>
                ))}
                <View style={[styles.row, styles.total, { borderTopColor: t.border }]}><Text style={{ color: t.text, fontWeight: '700' }}>Total</Text><Text style={{ color: t.text, fontWeight: '700', fontSize: 18 }}>K{total.toFixed(2)}</Text></View>

                {error ? <View style={[styles.error, { backgroundColor: t.dangerSoft }]}><Text style={{ color: t.danger }}>{error}</Text></View> : null}

                <Text style={[styles.label, { color: t.textSecondary }]}>Enter PIN to confirm</Text>
                <TextInput
                  style={[styles.pin, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
                  placeholder="6-digit PIN"
                  placeholderTextColor={t.textMuted}
                  secureTextEntry
                  keyboardType="numeric"
                  maxLength={6}
                  value={password}
                  onChangeText={setPassword}
                />
                <AppButton label="Send now" onPress={sendFunds} disabled={password.length < 4} />
              </GlassCard>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, marginTop: -24 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  total: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 14, marginBottom: 8 },
  error: { padding: 12, borderRadius: 12, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  pin: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 52, fontSize: 18, letterSpacing: 4, marginBottom: 16 },
});
