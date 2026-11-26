import PaySheet from '@/components/marketplace/PaySheet';
import { SectionCard, InfoText, PrimaryButton } from '@/components/marketplace/ui';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Marketplace() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [payVisible, setPayVisible] = useState(false);
  const chips = ['MTN', 'Airtel', 'Zamtel'];
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Marketplace" subtitle="Find nearby agents for cash in or out" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <SectionCard title="For customers">
          <InfoText>Request a nearby mobile money agent to withdraw or deposit cash.</InfoText>
          <PrimaryButton label="Request an agent" onPress={() => setPayVisible(true)} />
        </SectionCard>
        <SectionCard title="For agents">
          <InfoText>Go online, receive requests, and manage your earnings.</InfoText>
          <PrimaryButton label="Agent dashboard" tone="secondary" onPress={() => router.push('/agent/dashboard')} />
        </SectionCard>
        <SectionCard title="Supported networks">
          <View style={styles.row}>{chips.map(c => <View key={c} style={[styles.chip, { backgroundColor: t.accentSoftBg, borderColor: t.border }]}><Text style={{ color: t.tint, fontWeight: '600' }}>{c}</Text></View>)}</View>
        </SectionCard>
      </ScrollView>
      <PaySheet visible={payVisible} onClose={() => setPayVisible(false)} />
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 } });
