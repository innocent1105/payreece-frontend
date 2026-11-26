import { marketplace } from '@/components/lib/marketplace';
import { InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MarketplaceScreen() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [disclaimer, setDisclaimer] = useState(
    'Payreece coordinates agents only. We do not send, hold, verify, or confirm mobile money.',
  );

  useEffect(() => {
    marketplace('networks')
      .then((data) => {
        setNetworks(data.networks ?? []);
        if (data.disclaimer) setDisclaimer(data.disclaimer);
      })
      .catch((error) => console.warn('Failed to load marketplace settings', error));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="people-outline" size={34} color="#4C6FFF" />
          <Text style={styles.title}>Mobile Money Agents</Text>
        </View>
        <Text style={styles.subtitle}>
          Find a verified agent near you for cash withdrawals and deposits. Payreece never moves or holds your money.
        </Text>

        <SectionCard title="I need an agent">
          <InfoText>Choose a network and amount. Nearby verified agents receive your request in stages.</InfoText>
          <PrimaryButton label="Request an agent" onPress={() => router.push('/marketplace/request')} />
        </SectionCard>

        <SectionCard title="I want to serve customers">
          <InfoText>Register as an agent, declare your liquidity, and go online when you are ready.</InfoText>
          <PrimaryButton
            label="Agent dashboard"
            tone="secondary"
            onPress={() => router.push('/agent/dashboard')}
          />
        </SectionCard>

        <SectionCard title="Supported networks">
          <View style={styles.networks}>
            {networks.map((network) => (
              <View key={network.code} style={[styles.chip, { borderColor: network.color }]}>
                <Text style={styles.chipText}>{network.name}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard>
          <InfoText>{disclaimer}</InfoText>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  networks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
});
