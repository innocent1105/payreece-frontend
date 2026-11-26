import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import { ErrorText, Field, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AgentOnboarding() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [network, setNetwork] = useState('MTN');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      const res = await axios.post(`${BASE_URL}/marketplace.php`, { action: 'register_agent', token, name, network }, { timeout: 15000 });
      if (res.data?.success) router.replace('/agent/dashboard');
      else setError(res.data?.message || 'Could not register agent.');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Agent onboarding" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <SectionCard title="Become an agent">
          <InfoText>Register to receive nearby cash-in and cash-out requests.</InfoText>
          <Field label="Display name" value={name} onChangeText={setName} placeholder="Agent name" />
          <Field label="Primary network" value={network} onChangeText={setNetwork} placeholder="MTN / Airtel / Zamtel" />
          <ErrorText message={error} />
          <PrimaryButton label={loading ? 'Submitting...' : 'Submit'} onPress={submit} disabled={loading} />
        </SectionCard>
      </ScrollView>
    </View>
  );
}
