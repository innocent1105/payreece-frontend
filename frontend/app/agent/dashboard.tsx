import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import { ErrorText, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AgentDashboard() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [available, setAvailable] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const token = await getToken();
      const res = await axios.post(`${BASE_URL}/marketplace.php`, { action: 'agent_dashboard', token }, { timeout: 10000 });
      if (res.data?.success) { setData(res.data); setAvailable(!!res.data.available); }
      else setError(res.data?.message || 'Unable to load dashboard.');
    } catch { setError('Network error.'); }
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (v: boolean) => {
    setAvailable(v);
    try { const token = await getToken(); await axios.post(`${BASE_URL}/marketplace.php`, { action: 'set_availability', token, available: v ? 1 : 0 }, { timeout: 10000 }); }
    catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Agent dashboard" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <SectionCard title="Availability">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 12 }}><Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Online</Text><InfoText>Receive nearby requests when available.</InfoText></View>
            <Switch value={available} onValueChange={toggle} trackColor={{ false: t.border, true: t.tint }} thumbColor="#fff" />
          </View>
          <ErrorText message={error} />
        </SectionCard>
        <SectionCard title="Earnings">
          <Text style={{ color: t.text, fontSize: 30, fontWeight: '700' }}>K{data?.earnings ?? '0.00'}</Text>
          <InfoText>Today&apos;s completed jobs: {data?.jobs_today ?? 0}</InfoText>
        </SectionCard>
        <SectionCard title="Offers">
          <InfoText>{(data?.offers?.length || 0)} active offer(s).</InfoText>
          <PrimaryButton label="Refresh" tone="secondary" onPress={load} />
        </SectionCard>
      </ScrollView>
    </View>
  );
}
