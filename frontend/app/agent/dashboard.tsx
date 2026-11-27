import { ErrorText, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { getForegroundLocation, sendAgentLocation, startForegroundLocationSharing } from '@/components/lib/agent-location';
import { MarketplaceError, marketplace, marketplaceActivity } from '@/components/lib/marketplace';
import { BASE_URL } from '@/constants/api';
import { useAppTheme } from '@/hooks/use-theme-color';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Radius } from '@/constants/theme';
import { ScreenHero } from '@/components/ui/screen-hero';

const ACTIVE_AGENT_KEY = 'marketplace_active_agent';

export default function AgentDashboard() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTxId, setActiveTxId] = useState<number | null>(null);
  const [cash, setCash] = useState('');
  const [floatBalance, setFloatBalance] = useState('');
  const stopLocationRef = useRef<(() => void) | null>(null);
  const activeTxRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [agentProfile, agentEarnings, requestHistory] = await Promise.all([
        marketplace<any>('agent.profile'),
        marketplace<any>('agent.earnings'),
        marketplace<any>('request.history'),
      ]);
      setProfile(agentProfile);
      setEarnings(agentEarnings);
      setHistory(requestHistory?.history ?? []);
      if (activeTxRef.current) {
        try {
          const details = await marketplace<any>('transaction.get', { params: { transaction_id: activeTxRef.current } });
          if (['completed', 'cancelled', 'expired', 'disputed'].includes(String(details?.state ?? ''))) {
            await SecureStore.deleteItemAsync(ACTIVE_AGENT_KEY);
            activeTxRef.current = null;
            setActiveTxId(null);
          }
        } catch (err) {
          if (err instanceof MarketplaceError && (err.status === 404 || ['transaction_not_found', 'request_not_found'].includes(err.code))) {
            await SecureStore.deleteItemAsync(ACTIVE_AGENT_KEY);
            activeTxRef.current = null;
            setActiveTxId(null);
          }
        }
      }
      const liquidity = agentProfile?.liquidity?.[agentProfile?.networks?.[0]?.network] ?? null;
      if (liquidity) {
        setCash(String(Number(liquidity.cash_available ?? 0)));
        setFloatBalance(String(Number(liquidity.float_available ?? 0)));
      }
      if (agentProfile?.availability === 'available') {
        const data = await marketplace<any>('agent.offers');
        setOffers(data.offers ?? []);
      } else {
        setOffers([]);
      }
    } catch (err) {
      if (err instanceof MarketplaceError && err.code === 'agent_not_found') {
        router.replace('/agent/onboarding');
        return;
      }
      setError(err instanceof MarketplaceError ? err.message : 'Unable to load agent dashboard.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(ACTIVE_AGENT_KEY);
        const id = Number(stored ? JSON.parse(stored).transactionId ?? 0 : 0);
        if (id > 0) {
          try {
            const details = await marketplace<any>('transaction.get', { params: { transaction_id: id } });
            if (['completed', 'cancelled', 'expired', 'disputed'].includes(String(details?.state ?? ''))) {
              await SecureStore.deleteItemAsync(ACTIVE_AGENT_KEY);
              if (active) {
                setActiveTxId(null);
                activeTxRef.current = null;
                void load();
              }
              return;
            }
          } catch {}
          if (active) {
            setActiveTxId(id);
            activeTxRef.current = id;
          }
        } else if (active) {
          setActiveTxId(null);
          activeTxRef.current = null;
        }
      } catch {
        if (active) {
          setActiveTxId(null);
          activeTxRef.current = null;
        }
      }
    })();
    return () => { active = false; };
  }, [load]));

  useEffect(() => {
    const poll = setInterval(() => { if (profile?.availability === 'available') void load(); }, 4000);
    return () => clearInterval(poll);
  }, [profile?.availability, load]);

  useEffect(() => {
    if (profile?.availability !== 'available' || activeTxId) return;
    let cancelled = false;
    startForegroundLocationSharing(() => activeTxRef.current ?? undefined)
      .then((stop) => {
        if (cancelled) stop();
        else stopLocationRef.current = stop;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopLocationRef.current?.();
      stopLocationRef.current = null;
    };
  }, [profile?.availability, activeTxId]);

  const setAvailability = async (online: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (online) {
        const location = await getForegroundLocation();
        await sendAgentLocation(location);
      }
      const result = await marketplace<any>('agent.availability', {
        method: 'PUT',
        body: { availability: online ? 'available' : 'offline' },
      });
      setProfile((current: any) => ({ ...current, availability: result.availability }));
      if (!online) setOffers([]);
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Could not update availability.');
    } finally {
      setBusy(false);
    }
  };

  const saveLiquidity = async () => {
    const network = profile?.networks?.[0]?.network ?? 'MTN';
    setBusy(true);
    setError('');
    try {
      await marketplace('agent.liquidity', {
        method: 'PUT',
        body: { network, cash_balance: cash || '0', float_balance: floatBalance || '0' },
      });
      await load();
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Could not save liquidity.');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (offer: any, decision: 'accept' | 'reject') => {
    setBusy(true);
    setError('');
    try {
      const result = await marketplace<any>('agent.offer.respond', {
        method: 'POST',
        body: { offer_id: offer.offer_id, decision },
      });
      setOffers((current) => current.filter((item) => item.offer_id !== offer.offer_id));
      if (decision === 'accept' && result.transaction_id) {
        setProfile((current: any) => ({ ...current, availability: 'busy' }));
        setActiveTxId(Number(result.transaction_id));
        activeTxRef.current = Number(result.transaction_id);
        await SecureStore.setItemAsync(ACTIVE_AGENT_KEY, JSON.stringify({ transactionId: Number(result.transaction_id) }));
        router.push({ pathname: '/marketplace/map', params: { transaction_id: String(result.transaction_id), role: 'agent' } });
      }
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Could not respond to the offer.');
    } finally {
      setBusy(false);
    }
  };

  const openActiveJob = () => {
    if (activeTxId) router.push({ pathname: '/marketplace/map', params: { transaction_id: String(activeTxId), role: 'agent' } });
  };

  const offer = offers[0];
  const verified = profile?.verification_status === 'verified';
  const available = profile?.availability === 'available';

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero compact title="Agent dashboard" subtitle={profile?.business_name || 'Your agent workspace'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -16, paddingBottom: insets.bottom + 40 }}>
        <SectionCard title="Status">
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionText, { color: t.text }]}>{verified ? 'Verified agent' : 'Verification pending'}</Text>
              <InfoText>{verified ? 'You can receive nearby requests.' : 'Admin review is required before you can go online.'}</InfoText>
            </View>
            <Switch
              value={available}
              disabled={!verified || busy || !!activeTxId}
              onValueChange={(value) => void setAvailability(value)}
              trackColor={{ false: t.border, true: t.tint }}
              thumbColor="#fff"
            />
          </View>
          {available ? <InfoText>Keep the app open while online. Location is shared every few seconds.</InfoText> : null}
          {activeTxId ? (
            <Pressable onPress={openActiveJob} style={[styles.jobButton, { backgroundColor: t.accentSoftBg }]}>
              <Ionicons name="navigate" size={18} color={t.tint} />
              <Text style={{ color: t.tint, fontWeight: '700', marginLeft: 8 }}>Open active job</Text>
            </Pressable>
          ) : null}
          <ErrorText message={error} />
        </SectionCard>

        {offer ? (
          <SectionCard title="Incoming request">
            <View style={styles.offerProfile}>
              <Image
                source={{ uri: `${BASE_URL}/view_pp.php?file=${encodeURIComponent(offer.customer?.avatar || 'avatar1.jpg')}` }}
                style={styles.avatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.offerName, { color: t.text }]}>{offer.customer?.name ?? 'Customer'}</Text>
                <Text style={[styles.offerMeta, { color: t.textSecondary }]}>
                  {offer.customer?.phone ?? 'Phone hidden'} · {Math.round(offer.distance_m)} m away
                </Text>
              </View>
            </View>
            <View style={styles.offerStats}>
              <Stat label="Amount" value={`K${offer.amount}`} />
              <Stat label="Network" value={offer.network} />
              <Stat label="ETA" value={`${offer.eta_minutes} min`} />
            </View>
            <InfoText>
              {offer.direction === 'withdrawal' ? 'Customer wants to withdraw cash.' : 'Customer wants to deposit money.'} Earning: K{offer.expected_earning}.
            </InfoText>
            <View style={styles.offerActions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label={busy ? 'Accepting...' : 'Accept request'} onPress={() => void respond(offer, 'accept')} disabled={busy} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label={busy ? 'Working...' : 'Decline'} tone="danger" onPress={() => void respond(offer, 'reject')} disabled={busy} />
              </View>
            </View>
          </SectionCard>
        ) : null}

        <SectionCard title="Liquidity">
          <InfoText>Declare how much cash and float you can serve for {profile?.networks?.[0]?.network ?? 'your network'}.</InfoText>
          <View style={styles.inputRow}>
            <TextInputSmall label="Cash" value={cash} onChange={setCash} />
            <TextInputSmall label="Float" value={floatBalance} onChange={setFloatBalance} />
          </View>
          <PrimaryButton label={busy ? 'Saving...' : 'Save liquidity'} onPress={() => void saveLiquidity()} disabled={!verified || busy} tone="secondary" />
        </SectionCard>

        <SectionCard title="Earnings">
          <Text style={[styles.earnings, { color: t.text }]}>K{earnings?.total_earnings ?? '0.00'}</Text>
          <InfoText>Completed jobs: {earnings?.completed_jobs ?? 0} · Acceptance: {profile?.acceptance_rate ?? 0}%</InfoText>
        </SectionCard>

        <SectionCard title="Recent activity">
          {history.length === 0 ? (
            <InfoText>Accepted and completed requests will appear here.</InfoText>
          ) : history.map((item) => {
            const activity = marketplaceActivity(item);
            return (
              <Pressable
                key={activity.id}
                onPress={() => router.push({ pathname: '/marketplace/map', params: { transaction_id: String(activity.transaction_id), role: 'agent' } })}
                style={styles.historyRow}
              >
                <View style={[styles.historyIcon, { backgroundColor: t.accentSoftBg }]}>
                  <Ionicons name="swap-horizontal-outline" size={16} color={t.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyTitle, { color: t.text }]} numberOfLines={1}>{activity.title}</Text>
                  <Text style={[styles.historyMeta, { color: t.textMuted }]}>
                    {activity.date ? formatDistanceToNow(new Date(activity.date), { addSuffix: true }) : ''} · K{activity.amount}
                  </Text>
                </View>
                <Text style={[styles.historyState, { color: activity.state === 'completed' ? t.success : t.tint }]}>{activity.status}</Text>
              </Pressable>
            );
          })}
        </SectionCard>
      </ScrollView>

    </View>
  );
}

function TextInputSmall({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const t = useAppTheme();
  return (
    <View style={[styles.smallInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
      <Text style={[styles.smallLabel, { color: t.textMuted }]}>{label}</Text>
      <TextInputValue value={value} onChange={onChange} color={t.text} />
    </View>
  );
}

function TextInputValue({ value, onChange, color }: { value: string; onChange: (value: string) => void; color: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      placeholder="0.00"
      placeholderTextColor="#8E8E93"
      style={[styles.smallValue, { color }]}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useAppTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.inputBg }]}>
      <Text style={[styles.statLabel, { color: t.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionText: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  jobButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: Radius.sm, marginTop: 12 },
  inputRow: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  smallInput: { flex: 1, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  smallLabel: { fontSize: 11, fontWeight: '600' },
  smallValue: { fontSize: 17, fontWeight: '700', paddingVertical: 2 },
  earnings: { fontSize: 30, fontWeight: '800' },
  offerProfile: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  offerName: { fontSize: 17, fontWeight: '700' },
  offerMeta: { fontSize: 12, marginTop: 3 },
  offerStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  offerActions: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: Radius.sm },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  rejectButton: { alignItems: 'center', paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1, marginTop: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  historyIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 14, fontWeight: '600' },
  historyMeta: { fontSize: 11, marginTop: 2 },
  historyState: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
