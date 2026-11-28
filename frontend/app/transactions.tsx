import { getToken } from '@/components/auth/auth';
import { BASE_URL } from '@/constants/api';
import { marketplaceActivity, marketplaceHistory } from '@/components/lib/marketplace';
import NoTransactions from '@/components/no-transactions';
import { ScreenHero } from '@/components/ui/screen-hero';
import { GlassCard } from '@/components/ui/glass-card';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TransactionsScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const cached = await SecureStore.getItemAsync('p-transactions');
      if (cached) setTxs(JSON.parse(cached));
    } catch {}
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await axios.post(`${BASE_URL}/dashboard.php`, { token }, { timeout: 10000 });
      if (res.data?.success) {
        const list = res.data.data?.transactions ?? [];
        setTxs(list);
        await SecureStore.setItemAsync('p-transactions', JSON.stringify(list));
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadHistory = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const rows = await marketplaceHistory(100);
      setHistory(rows.map(marketplaceActivity));
    } catch {}
  };

  const allTxs = useMemo(
    () => [...txs, ...history].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [txs, history],
  );

  useEffect(() => {
    const timer = setTimeout(() => { void load(); void loadHistory(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Transactions" onBack={() => router.back()} compact />
      <View style={styles.body}>
        <GlassCard style={{ flex: 1, padding: 0 }}>
          {loading ? <ActivityIndicator color={t.tint} style={{ marginTop: 40 }} /> : (
            <FlatList
              data={allTxs}
              keyExtractor={(item, i) => String(item.id || item.public_id || i)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void Promise.all([load(), loadHistory()]); }} tintColor={t.tint} />}
              ListEmptyComponent={<NoTransactions onDepositPress={() => router.push('/deposit_funds')} />}
              contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 20 }}
              renderItem={({ item, index }) => {
                const isMarketplace = item.type === 'marketplace';
                const isTransfer = item.type === 'transfer' || item.type === 'sent' || item.type === 'received';
                const counterparty = item.other_sender_name || item.other_sender_number;
                const incoming = isMarketplace ? !item.from_me : item.type === 'deposit' || (isTransfer && !item.from_me);
                const title = isMarketplace ? item.title : item.type === 'deposit' ? 'Deposit' : isTransfer ? (item.from_me ? `Sent to ${counterparty || 'recipient'}` : `From ${counterparty || 'sender'}`) : 'Transaction';
                const onPress = isMarketplace
                  ? () => router.push({ pathname: '/marketplace/map', params: { transaction_id: String(item.transaction_id || ''), role: item.role } })
                  : () => router.push({ pathname: '/transaction', params: item });
                return (
                  <Pressable onPress={onPress} style={[styles.row, index < allTxs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
                    <View style={[styles.icon, { backgroundColor: incoming ? t.successSoft : t.accentSoftBg }]}><Feather name={incoming ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={incoming ? t.success : t.tint} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 12 }}>{item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ''}</Text>
                    </View>
                    <Text style={{ color: incoming ? t.success : t.text, fontWeight: '700' }}>{incoming ? '+' : '-'}K{item.amount}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 0, marginTop: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
});
