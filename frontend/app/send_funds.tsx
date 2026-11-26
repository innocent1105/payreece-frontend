import { ScreenHero } from '@/components/ui/screen-hero';
import { GlassCard } from '@/components/ui/glass-card';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SendFunds() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [amount, setAmount] = useState('0');
  const quick = [50, 100, 200, 500, 1000];

  const press = (k: string) => {
    if (k === 'back') return setAmount(a => (a.length <= 1 ? '0' : a.slice(0, -1)));
    if (k === '.') return setAmount(a => (a.includes('.') ? a : a + '.'));
    setAmount(a => (a === '0' ? k : a + k).slice(0, 9));
  };

  const numeric = parseFloat(amount) || 0;
  const canProceed = numeric > 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <ScreenHero title="Send money" subtitle={params?.name ? `To ${params.name}` : 'Enter amount'} onBack={() => router.back()} />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(380)}>
            <GlassCard style={styles.amountCard}>
              <Text style={[styles.label, { color: t.textSecondary }]}>Amount</Text>
              <Text style={[styles.amount, { color: t.text }]}>K{amount}</Text>
              <View style={styles.quickRow}>
                {quick.map(q => (
                  <Pressable key={q} onPress={() => setAmount(String(q))} style={[styles.quick, { backgroundColor: t.accentSoftBg, borderColor: t.border }]}>
                    <Text style={{ color: t.tint, fontWeight: '600', fontSize: 13 }}>K{q}</Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(380)}>
            <GlassCard>
              <View style={styles.pad}>
                {['1','2','3','4','5','6','7','8','9','.','0','back'].map(k => (
                  <Pressable key={k} onPress={() => press(k)} style={({ pressed }) => [styles.key, { backgroundColor: pressed ? t.surfaceMuted : 'transparent' }]}>
                    {k === 'back' ? <Ionicons name="backspace-outline" size={24} color={t.text} /> : <Text style={[styles.keyText, { color: t.text }]}>{k}</Text>}
                  </Pressable>
                ))}
              </View>
              <AppButton
                label="Continue"
                disabled={!canProceed}
                onPress={() => router.push({ pathname: '/send', params: { ...params, amount } })}
                style={{ marginTop: 8 }}
              />
            </GlassCard>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, marginTop: -24 },
  amountCard: { alignItems: 'center', paddingVertical: 24 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  amount: { fontSize: 48, fontWeight: '700', letterSpacing: -1.5, marginTop: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  quick: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: { width: '33%', height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  keyText: { fontSize: 28, fontWeight: '500' },
});
