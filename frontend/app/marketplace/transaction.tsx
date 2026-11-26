import { marketplace } from '@/components/lib/marketplace';
import MarketplaceMap from '@/components/marketplace/MarketplaceMap';
import { ErrorText, Field, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_TRANSACTION_KEY = 'mm-active-transaction';

export default function MarketplaceTransactionScreen() {
  const params = useLocalSearchParams<{ transaction_id?: string; role?: string }>();
  const [tx, setTx] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [handoverCode, setHandoverCode] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [rating, setRating] = useState('5');
  const [ratingComment, setRatingComment] = useState('');

  const role = params.role ?? (tx?.handover_code ? 'customer' : 'agent');

  const load = useCallback(async () => {
    try {
      const data = await marketplace('transaction.get', {
        params: { transaction_id: params.transaction_id },
      });
      setTx(data);
      if (['completed', 'cancelled', 'expired', 'disputed'].includes(data.state)) {
        await SecureStore.deleteItemAsync(ACTIVE_TRANSACTION_KEY).catch(() => undefined);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load transaction.');
    }
  }, [params.transaction_id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!busy) {
        void load();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [load, busy]);

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

  const action = async (marketplaceAction: string, body: Record<string, unknown>, successMessage?: string) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await marketplace(marketplaceAction, { method: 'POST', body });
      setNotice(successMessage ?? 'Updated.');
      await load();
      return result;
    } catch (err: any) {
      setError(err.message || 'Could not complete action.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!tx) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorText message={error} />
        <InfoText>Loading transaction...</InfoText>
      </SafeAreaView>
    );
  }

  const canCancel = ['searching', 'accepted', 'agent_en_route', 'arrived'].includes(tx.state);
  const canDispute = ['accepted', 'agent_en_route', 'arrived', 'processing'].includes(tx.state);
  const mapTitle = role === 'customer' ? 'Agent location' : 'Pickup location';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction #{tx.transaction_id}</Text>
        <Text style={styles.state}>{tx.state.replace(/_/g, ' ')}</Text>

        <SectionCard title="Details">
          <Text style={styles.detail}>
            {tx.direction === 'withdrawal' ? 'Cash withdrawal' : 'Money deposit'} · {tx.network}
          </Text>
          <Text style={styles.detail}>Amount: ZMW {tx.amount}</Text>
          <Text style={styles.detail}>Platform fee: ZMW {tx.platform_fee}</Text>
          <Text style={styles.detail}>Agent earning: ZMW {tx.agent_earning}</Text>
          {tx.agent && <Text style={styles.detail}>Agent: {tx.agent.business_name ?? tx.agent.name}</Text>}
          {tx.customer && role === 'agent' && <Text style={styles.detail}>Customer: {tx.customer.name}</Text>}
          {tx.agent?.phone && role === 'customer' && <Text style={styles.detail}>Agent phone: {tx.agent.phone}</Text>}
          {tx.customer?.phone && role === 'agent' && <Text style={styles.detail}>Customer phone: {tx.customer.phone}</Text>}
        </SectionCard>

        {tx.handover_code && role === 'customer' && (
          <SectionCard title="Handover code">
            <Text style={styles.code}>{tx.handover_code}</Text>
            <InfoText>Show this code to the agent only after you have received or handed over the cash.</InfoText>
          </SectionCard>
        )}

        {tx.location && (
          <SectionCard title="Live location">
            <MarketplaceMap
              lat={tx.location.lat}
              lng={tx.location.lng}
              polyline={tx.route?.polyline ?? []}
              title={mapTitle}
            />
            <InfoText>
              {tx.route?.provider === 'straight_line'
                ? 'Route shown as a straight line because routing data is not configured.'
                : `Route from ${tx.route?.provider ?? 'map'}.`}
            </InfoText>
          </SectionCard>
        )}

        {role === 'agent' && ['accepted', 'agent_en_route', 'arrived'].includes(tx.state) && (
          <SectionCard title="Job progress">
            {tx.state === 'accepted' && (
              <PrimaryButton label="Start travel" onPress={() => action('transaction.transition', { transaction_id: tx.transaction_id, action: 'en_route' }, 'Marked as en route.')} disabled={busy} />
            )}
            {tx.state === 'agent_en_route' && (
              <PrimaryButton label="Mark arrived" onPress={() => action('transaction.transition', { transaction_id: tx.transaction_id, action: 'arrived' }, 'Marked as arrived.')} disabled={busy} />
            )}
            {tx.state === 'arrived' && (
              <PrimaryButton label="Start money handling" onPress={() => action('transaction.transition', { transaction_id: tx.transaction_id, action: 'processing' }, 'Job is ready for confirmation.')} disabled={busy} />
            )}
          </SectionCard>
        )}

        {tx.state === 'processing' && role === 'customer' && !tx.customer_confirmed_at && (
          <SectionCard title="Confirm service">
            <InfoText>Confirm only after the cash/mobile money step is complete.</InfoText>
            <PrimaryButton label="I confirm" onPress={() => action('transaction.confirm', { transaction_id: tx.transaction_id, role: 'customer' }, 'Confirmation recorded.')} disabled={busy} />
          </SectionCard>
        )}

        {tx.state === 'processing' && role === 'agent' && (
          <SectionCard title="Agent confirmation">
            {!tx.customer_confirmed_at ? (
              <InfoText>Waiting for the customer to confirm.</InfoText>
            ) : (
              <>
                <InfoText>Enter the six-digit code shown by the customer.</InfoText>
                <Field label="Handover code" value={handoverCode} onChangeText={setHandoverCode} keyboardType="numeric" placeholder="000000" />
                <PrimaryButton label="Confirm with code" onPress={() => action('transaction.confirm', { transaction_id: tx.transaction_id, role: 'agent', handover_code: handoverCode }, 'Confirmation recorded.')} disabled={busy || handoverCode.length < 4} />
              </>
            )}
          </SectionCard>
        )}

        {tx.state === 'completed' && role === 'customer' && (
          <SectionCard title="Rate this agent">
            <Field label="Rating (1-5)" value={rating} onChangeText={setRating} keyboardType="numeric" />
            <Field label="Comment" value={ratingComment} onChangeText={setRatingComment} placeholder="Optional" multiline />
            <PrimaryButton label="Submit rating" onPress={() => action('transaction.rate', { transaction_id: tx.transaction_id, rating: Number(rating), comment: ratingComment }, 'Thank you for rating.')} disabled={busy} />
          </SectionCard>
        )}

        {canDispute && (
          <SectionCard title="Report a problem">
            <Field label="Reason" value={disputeReason} onChangeText={setDisputeReason} placeholder="Describe the issue" multiline />
            <PrimaryButton label="Open dispute" tone="danger" onPress={() => action('transaction.dispute', { transaction_id: tx.transaction_id, reason: disputeReason }, 'Dispute opened.')} disabled={busy || disputeReason.length < 5} />
          </SectionCard>
        )}

        {canCancel && (
          <PrimaryButton
            label="Cancel transaction"
            tone="danger"
            onPress={() => action('transaction.cancel', { transaction_id: tx.transaction_id, reason: 'Cancelled in app' }, 'Transaction cancelled.')}
            disabled={busy}
          />
        )}

        {notice && <InfoText>{notice}</InfoText>}
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
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  state: {
    color: '#4C6FFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  detail: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 5,
  },
  code: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
});
