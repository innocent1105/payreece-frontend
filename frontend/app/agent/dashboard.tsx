import { startForegroundLocationSharing, sendAgentLocation, getForegroundLocation } from '@/components/lib/agent-location';
import { marketplace } from '@/components/lib/marketplace';
import MarketplaceMap from '@/components/marketplace/MarketplaceMap';
import { ErrorText, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TRANSACTION_KEY = 'mm-active-transaction';

export default function AgentDashboardScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const [cash, setCash] = useState('');
  const [floatBalance, setFloatBalance] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const stopSharingRef = useRef<(() => void) | null>(null);
  const activeTransactionRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [agentProfile, agentOffers, agentEarnings, storedTx] = await Promise.all([
        marketplace('agent.profile'),
        marketplace('agent.offers'),
        marketplace('agent.earnings'),
        SecureStore.getItemAsync(ACTIVE_TRANSACTION_KEY),
      ]);
      setProfile(agentProfile);
      setOffers(agentOffers.offers ?? []);
      setEarnings(agentEarnings);
      setActiveTransaction(storedTx);
      activeTransactionRef.current = storedTx;
      const liquidity = agentProfile.liquidity?.[selectedNetwork];
      if (liquidity) {
        setCash(liquidity.cash_balance ?? '');
        setFloatBalance(liquidity.float_balance ?? '');
      }
    } catch (err: any) {
      setError(err.message || 'Could not load agent dashboard.');
    }
  }, [selectedNetwork]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      marketplace('agent.offers')
        .then((data) => setOffers(data.offers ?? []))
        .catch(() => undefined);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const active = Number(activeTransactionRef.current ?? 0);
    if (profile?.availability === 'available' && !stopSharingRef.current) {
      startForegroundLocationSharing(() => (active > 0 ? active : undefined))
        .then((stop) => {
          stopSharingRef.current = stop;
        })
        .catch((err) => setError(err.message));
    }
    return () => undefined;
  }, [profile?.availability]);

  useEffect(() => () => stopSharingRef.current?.(), []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleAvailability = async () => {
    setError('');
    setBusy(true);
    try {
      if (profile?.availability === 'available') {
        await marketplace('agent.availability', { method: 'PUT', body: { availability: 'offline' } });
        stopSharingRef.current?.();
        stopSharingRef.current = null;
      } else {
        const location = await getForegroundLocation();
        await sendAgentLocation(location, Number(activeTransactionRef.current ?? 0) || undefined);
        await marketplace('agent.availability', { method: 'PUT', body: { availability: 'available' } });
        const active = Number(activeTransactionRef.current ?? 0);
        const stop = await startForegroundLocationSharing(() => (active > 0 ? active : undefined));
        stopSharingRef.current = stop;
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const respondOffer = async (offerId: number, decision: 'accept' | 'reject') => {
    setError('');
    setBusy(true);
    try {
      const result = await marketplace('agent.offer.respond', {
        method: 'POST',
        body: { offer_id: offerId, decision },
      });
      if (decision === 'accept' && result.transaction_id) {
        await SecureStore.setItemAsync(ACTIVE_TRANSACTION_KEY, String(result.transaction_id));
        setActiveTransaction(String(result.transaction_id));
        activeTransactionRef.current = String(result.transaction_id);
        router.push({
          pathname: '/marketplace/transaction',
          params: { transaction_id: result.transaction_id, role: 'agent' },
        });
        return;
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveLiquidity = async () => {
    setError('');
    setBusy(true);
    try {
      await marketplace('agent.liquidity', {
        method: 'PUT',
        body: { network: selectedNetwork, cash_balance: cash, float_balance: floatBalance },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorText message={error} />
        <InfoText>Loading agent dashboard...</InfoText>
      </SafeAreaView>
    );
  }

  const verified = profile.verification_status === 'verified';
  const available = profile.availability === 'available';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Agent dashboard</Text>

        <SectionCard title={profile.business_name}>
          <Text style={styles.status}>Status: {profile.verification_status}</Text>
          <Text style={styles.status}>Availability: {profile.availability}</Text>
          <Text style={styles.rating}>Rating: {profile.rating_avg} ({profile.rating_count})</Text>
          {profile.rejection_reason && <ErrorText message={profile.rejection_reason} />}
          <PrimaryButton label="Edit profile" tone="secondary" onPress={() => router.push('/agent/onboarding')} />
          <PrimaryButton
            label={busy ? 'Please wait...' : available ? 'Go offline' : 'Go available'}
            onPress={toggleAvailability}
            disabled={busy || !verified}
          />
          {!verified && <InfoText>You must be verified before receiving customer requests.</InfoText>}
          {available && <InfoText>Foreground location sharing is active. Keep the app open.</InfoText>}
        </SectionCard>

        {activeTransaction && (
          <SectionCard title="Active job">
            <InfoText>Transaction #{activeTransaction}</InfoText>
            <PrimaryButton
              label="Open job"
              tone="secondary"
              onPress={() => router.push({ pathname: '/marketplace/transaction', params: { transaction_id: activeTransaction, role: 'agent' } })}
            />
          </SectionCard>
        )}

        <SectionCard title={`Offers (${offers.length})`}>
          {offers.length === 0 && <InfoText>No open offers right now.</InfoText>}
          {offers.map((offer) => (
            <View key={offer.offer_id} style={styles.offer}>
              <Text style={styles.offerTitle}>
                {offer.direction === 'withdrawal' ? 'Cash withdrawal' : 'Money deposit'} · ZMW {offer.amount}
              </Text>
              <Text style={styles.offerDetail}>{offer.network} · Earning ZMW {offer.expected_earning}</Text>
              <Text style={styles.offerDetail}>{Math.round(offer.distance_m)} m away · about {offer.eta_minutes} min</Text>
              <Text style={styles.offerDetail}>{offer.pickup_address}</Text>
              <MarketplaceMap
                lat={profile.lat}
                lng={profile.lng}
                counterpartLat={offer.pickup_lat}
                counterpartLng={offer.pickup_lng}
                title="Your location"
                counterpartTitle="Customer pickup"
              />
              <View style={styles.row}>
                <PrimaryButton label="Accept" onPress={() => respondOffer(offer.offer_id, 'accept')} disabled={busy} />
                <PrimaryButton label="Reject" tone="danger" onPress={() => respondOffer(offer.offer_id, 'reject')} disabled={busy} />
              </View>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Declare liquidity">
          <InfoText>These figures are self-declared. Payreece does not verify external mobile money balances.</InfoText>
          <View style={styles.networks}>
            {(profile.networks ?? []).map((network: any) => (
              <TouchableOpacity
                key={network.network}
                onPress={() => {
                  setSelectedNetwork(network.network);
                  const item = profile.liquidity?.[network.network];
                  setCash(item?.cash_balance ?? '');
                  setFloatBalance(item?.float_balance ?? '');
                }}
                style={[styles.networkChip, selectedNetwork === network.network && styles.networkChipActive]}
              >
                <Text style={[styles.networkText, selectedNetwork === network.network && styles.networkTextActive]}>{network.network}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Cash on hand</Text>
          <TextInput style={styles.input} value={cash} onChangeText={setCash} keyboardType="decimal-pad" />
          <Text style={styles.label}>Float balance</Text>
          <TextInput style={styles.input} value={floatBalance} onChangeText={setFloatBalance} keyboardType="decimal-pad" />
          <PrimaryButton label="Save liquidity" tone="secondary" onPress={saveLiquidity} disabled={busy} />
        </SectionCard>

        <SectionCard title="Earnings">
          <Text style={styles.status}>Completed jobs: {earnings?.completed_jobs ?? 0}</Text>
          <Text style={styles.status}>Total earnings: ZMW {earnings?.total_earnings ?? '0.00'}</Text>
        </SectionCard>

        <ErrorText message={error} />
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
    marginBottom: 16,
  },
  status: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 4,
  },
  rating: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 8,
  },
  offer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 12,
    gap: 4,
  },
  offerTitle: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
  offerDetail: {
    color: '#6B7280',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  networks: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
});
