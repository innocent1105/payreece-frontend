import { getForegroundLocation } from '@/components/lib/agent-location';
import { marketplace, newIdempotencyKey } from '@/components/lib/marketplace';
import { ErrorText, Field, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MarketplaceRequestScreen() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [direction, setDirection] = useState<'withdrawal' | 'deposit'>('withdrawal');
  const [network, setNetwork] = useState('MTN');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const keyRef = useRef<string>(newIdempotencyKey('mm-request'));

  useEffect(() => {
    marketplace('networks')
      .then((data) => setNetworks(data.networks ?? []))
      .catch((err) => setError(err.message));
    getForegroundLocation()
      .then(() => setLocationReady(true))
      .catch((err) => setError(err.message));
  }, []);

  const submit = async () => {
    setError('');
    if (!locationReady) {
      setError('Location permission and a current position are required.');
      return;
    }
    setLoading(true);
    try {
      const location = await getForegroundLocation();
      const result = await marketplace('customer.request.create', {
        method: 'POST',
        body: {
          direction,
          network,
          amount,
          pickup_lat: location.lat,
          pickup_lng: location.lng,
          pickup_address: address,
        },
        idempotencyKey: keyRef.current,
      });
      router.push({
        pathname: '/marketplace/transaction',
        params: {
          transaction_id: result.transaction?.transaction_id ?? '',
          public_id: result.public_id ?? '',
          role: 'customer',
        },
      });
    } catch (err: any) {
      setError(err.message || 'Could not create request.');
      keyRef.current = newIdempotencyKey('mm-request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Request an agent</Text>
        <InfoText>We share your pickup position only with the assigned agent.</InfoText>

        <SectionCard title="Service">
          <View style={styles.segment}>
            <TouchableOpacity
              onPress={() => setDirection('withdrawal')}
              style={[styles.segmentButton, direction === 'withdrawal' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, direction === 'withdrawal' && styles.segmentTextActive]}>Withdraw cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDirection('deposit')}
              style={[styles.segmentButton, direction === 'deposit' && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, direction === 'deposit' && styles.segmentTextActive]}>Deposit money</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Network</Text>
          <View style={styles.networks}>
            {networks.map((item) => (
              <TouchableOpacity
                key={item.code}
                onPress={() => setNetwork(item.code)}
                style={[styles.networkChip, network === item.code && styles.networkChipActive]}
              >
                <Text style={[styles.networkText, network === item.code && styles.networkTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field
            label="Amount (ZMW)"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <Field
            label="Pickup address"
            value={address}
            onChangeText={setAddress}
            placeholder="Landmark, street, or business name"
            multiline
          />
        </SectionCard>

        <ErrorText message={error} />
        {!locationReady && <InfoText>Waiting for your location...</InfoText>}
        <PrimaryButton label={loading ? 'Searching...' : 'Find an agent'} onPress={submit} disabled={loading} />
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
  back: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EFF2FF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#4C6FFF',
  },
  networks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  networkChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  networkChipActive: {
    borderColor: '#4C6FFF',
    backgroundColor: '#EFF2FF',
  },
  networkText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  networkTextActive: {
    color: '#4C6FFF',
  },
});
