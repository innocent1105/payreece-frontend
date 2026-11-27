import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';
import BottomSheet from './BottomSheet';

type Direction = 'withdrawal' | 'deposit';
type Network = 'MTN' | 'AIRTEL' | 'ZAMTEL';

const NETWORKS: { code: Network; name: string; color: string; short: string }[] = [
  { code: 'MTN', name: 'MTN MoMo', color: '#FFCC00', short: 'M' },
  { code: 'AIRTEL', name: 'Airtel Money', color: '#E4002B', short: 'A' },
  { code: 'ZAMTEL', name: 'Zamtel Kwacha', color: '#0057A8', short: 'Z' },
];

export default function PaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useAppTheme();
  const [direction, setDirection] = useState<Direction>('withdrawal');
  const [network, setNetwork] = useState<Network>('MTN');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('Near me');
  const [error, setError] = useState('');

  const proceed = () => {
    const value = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (address.trim().length < 3) {
      setError('Add a short pickup note.');
      return;
    }
    setError('');
    onClose();
    router.push({
      pathname: '/marketplace/map',
      params: {
        direction,
        network,
        amount: value.toFixed(2),
        address: address.trim(),
      },
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Request an agent">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.segment, { backgroundColor: t.inputBg }]}>
          {([
            { key: 'withdrawal', label: 'Withdraw', icon: 'cash-outline' },
            { key: 'deposit', label: 'Deposit', icon: 'arrow-down-circle-outline' },
          ] as const).map((tab) => {
            const active = direction === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setDirection(tab.key)}
                style={[styles.segmentButton, active && { backgroundColor: t.surface, shadowColor: t.cardShadow }]}
              >
                <Ionicons name={tab.icon} size={17} color={active ? t.tint : t.textMuted} />
                <Text style={[styles.segmentLabel, { color: active ? t.text : t.textMuted }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Network</Text>
        <View style={styles.networks}>
          {NETWORKS.map((item) => {
            const active = network === item.code;
            return (
              <Pressable
                key={item.code}
                onPress={() => setNetwork(item.code)}
                style={[
                  styles.networkCard,
                  { backgroundColor: active ? t.accentSoftBg : t.inputBg, borderColor: active ? t.tint : t.inputBorder },
                ]}
              >
                <View style={[styles.networkDot, { backgroundColor: item.color }]}>
                  <Text style={styles.networkShort}>{item.short}</Text>
                </View>
                <Text style={[styles.networkName, { color: active ? t.text : t.textSecondary }]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Amount</Text>
        <View style={[styles.amountBox, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
          <Text style={[styles.currency, { color: t.textMuted }]}>ZMW</Text>
          <TextInput
            style={[styles.amountInput, { color: t.text }]}
            value={amount}
            onChangeText={(value) => { setAmount(value); setError(''); }}
            placeholder="0.00"
            placeholderTextColor={t.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>

        <View style={[styles.amountBox, { backgroundColor: t.inputBg, borderColor: t.inputBorder, marginBottom: 8 }]}>
          <Ionicons name="location-outline" size={18} color={t.textMuted} />
          <TextInput
            style={[styles.noteInput, { color: t.text }]}
            value={address}
            onChangeText={(value) => { setAddress(value); setError(''); }}
            placeholder="Pickup note"
            placeholderTextColor={t.textMuted}
          />
        </View>

        {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}

        <Pressable onPress={proceed} style={[styles.proceed, { backgroundColor: t.tint }]}>
          <Text style={styles.proceedText}>Proceed</Text>
          <Ionicons name="arrow-forward" size={19} color="#fff" />
        </Pressable>
        <Text style={[styles.disclaimer, { color: t.textMuted }]}>
          Your location is shared with nearby agents only while a request is active.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.md, marginBottom: 18 },
  segmentButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 11 },
  segmentLabel: { fontWeight: '700', fontSize: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 9 },
  networks: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  networkCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, gap: 7 },
  networkDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  networkShort: { color: '#fff', fontWeight: '800', fontSize: 14 },
  networkName: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  amountBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 54, marginBottom: 18 },
  currency: { fontSize: 14, fontWeight: '700' },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700' },
  noteInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  error: { fontSize: 13, marginBottom: 8 },
  proceed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 15, borderRadius: Radius.md },
  proceedText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 15 },
});
