import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import { ErrorText, Field, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import axios from 'axios';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketplaceRequest() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [direction, setDirection] = useState<'withdraw_cash' | 'deposit_money'>('withdraw_cash');
  const [network, setNetwork] = useState('MTN');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission is required.'); setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const token = await getToken();
      const res = await axios.post(`${BASE_URL}/marketplace.php`, {
        action: 'create_request', token, direction, network, amount, pickup_address: address,
        latitude: loc.coords.latitude, longitude: loc.coords.longitude, idempotency_key: `${Date.now()}-${Math.random()}`
      }, { timeout: 15000 });
      if (res.data?.success) router.push({ pathname: '/marketplace/transaction', params: { id: res.data.request_id || res.data.id } });
      else setError(res.data?.message || 'Could not create request.');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Request agent" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <SectionCard title="Request details">
          <InfoText>Your location is shared only for matching and active job coordination.</InfoText>
          <View style={[styles.seg, { backgroundColor: t.inputBg }]}>
            {[{k:'withdraw_cash',l:'Withdraw cash'},{k:'deposit_money',l:'Deposit money'}].map(o => {
              const active = direction === o.k;
              return <Pressable key={o.k} onPress={() => setDirection(o.k as any)} style={[styles.segBtn, active && { backgroundColor: t.surface }]}><Text style={{ color: active ? t.text : t.textMuted, fontWeight: '600', fontSize: 13 }}>{o.l}</Text></Pressable>;
            })}
          </View>
          <View style={styles.chips}>{['MTN','Airtel','Zamtel'].map(n => <Pressable key={n} onPress={() => setNetwork(n)} style={[styles.chip, { backgroundColor: network===n ? t.accentSoftBg : t.inputBg, borderColor: network===n ? t.tint : t.inputBorder }]}><Text style={{ color: network===n ? t.tint : t.textSecondary, fontWeight: '600' }}>{n}</Text></Pressable>)}</View>
          <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" />
          <Field label="Pickup address / note" value={address} onChangeText={setAddress} placeholder="Landmark or address" multiline />
          <ErrorText message={error} />
          <PrimaryButton label={loading ? 'Finding agent...' : 'Find an agent'} onPress={submit} disabled={loading} />
        </SectionCard>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ seg: { flexDirection: 'row', padding: 4, borderRadius: 14, marginVertical: 14 }, segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 }, chips: { flexDirection: 'row', gap: 8, marginBottom: 14 }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 } });
