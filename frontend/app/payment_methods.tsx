import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PaymentMethods() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('mm');
  const opts = [
    { id: 'mm', title: 'Mobile Money', sub: 'MTN, Airtel, Zamtel', icon: <MaterialIcons name="phone-android" size={22} color={t.tint} /> },
    { id: 'card', title: 'Card', sub: 'Visa & Mastercard', icon: <FontAwesome name="credit-card" size={20} color={t.tint} /> },
    { id: 'paypal', title: 'PayPal', sub: 'Connect your account', icon: <FontAwesome name="paypal" size={20} color={t.tint} /> },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Payment methods" onBack={() => router.back()} compact />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <GlassCard style={{ padding: 6 }}>
          {opts.map((o, i) => (
            <Pressable key={o.id} onPress={() => setSelected(o.id)} style={[styles.row, i < opts.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
              <View style={[styles.icon, { backgroundColor: t.accentSoftBg }]}>{o.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 16 }}>{o.title}</Text>
                <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 2 }}>{o.sub}</Text>
              </View>
              <Ionicons name={selected === o.id ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected === o.id ? t.tint : t.textMuted} />
            </Pressable>
          ))}
        </GlassCard>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }, icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' } });
