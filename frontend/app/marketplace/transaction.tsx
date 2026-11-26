import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import { ErrorText, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketplaceTransaction() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<any>();
  const [tx, setTx] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const token = await getToken();
      const res = await axios.post(`${BASE_URL}/marketplace.php`, { action: 'get_transaction', token, id }, { timeout: 10000 });
      if (res.data?.success) setTx(res.data.transaction || res.data.data);
      else setError(res.data?.message || 'Unable to load transaction.');
    } catch { setError('Network error.'); }
  };

  useEffect(() => { void load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [id]);

  const action = async (name: string) => {
    try {
      const token = await getToken();
      await axios.post(`${BASE_URL}/marketplace.php`, { action: name, token, id }, { timeout: 10000 });
      load();
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Marketplace job" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <SectionCard title="Status">
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' }}>{(tx?.status || 'loading').replace(/_/g, ' ')}</Text>
          {tx?.handover_code ? <Text style={{ color: t.tint, fontSize: 28, fontWeight: '700', marginTop: 10, letterSpacing: 2 }}>{tx.handover_code}</Text> : null}
          <InfoText>{tx?.pickup_address || 'Waiting for updates...'}</InfoText>
          <ErrorText message={error} />
        </SectionCard>
        <SectionCard title="Actions">
          <PrimaryButton label="Refresh" tone="secondary" onPress={load} />
          <PrimaryButton label="Cancel request" tone="danger" onPress={() => action('cancel_request')} />
        </SectionCard>
      </ScrollView>
    </View>
  );
}
