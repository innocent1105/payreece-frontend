import { getToken } from '@/components/auth/auth';
import { BASE_URL } from '@/constants/api';
import { listNudges, markNudgesRead, marketplaceActivity, marketplaceHistory } from '@/components/lib/marketplace';
import NoTransactions from '@/components/no-transactions';
import { ThemedView } from '@/components/themed-view';
import { GlassCard } from '@/components/ui/glass-card';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

const saveDashboardData = async (data: any) => { try { await SecureStore.setItemAsync('dashboard_data', JSON.stringify(data)); } catch {} };
const getLocal = async (k: string) => { try { const d = await SecureStore.getItemAsync(k); return d ? JSON.parse(d) : null; } catch { return null; } };
const saveTransactions = async (data: any) => { try { await SecureStore.setItemAsync('p-transactions', data); } catch {} };

export default function HomeScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState('-');
  const [currency, setCurrency] = useState('K');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [nudges, setNudges] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const avatars: any = {
    avatar1: require('../../assets/images/avatars/avatar1.jpg'),
    avatar2: require('../../assets/images/avatars/avatar2.jpg'),
    avatar3: require('../../assets/images/avatars/avatar3.jpg'),
  };

  const hydrateFromLocal = async () => {
    const dash = await getLocal('dashboard_data');
    if (dash?.data) {
      const d = dash.data;
      setBalance(d.wallet?.balance ?? '-');
      setCurrency(d.wallet?.currency ?? 'K');
      setTransactions(d.transactions ?? []);
      setPhone(d.phone_number ?? '');
    }
    const tx = await getLocal('p-transactions');
    if (Array.isArray(tx)) setTransactions(tx);
  };

  const syncContacts = async () => {
    try {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') return;
      const data = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES], { limit: 1000, sortOrder: ContactsSortOrder.GivenName });
      const numbers = data.flatMap(c => c.phones?.map(p => p.number) || []).filter(Boolean);
      if (!numbers.length) return;
      const res = await axios.post(`${BASE_URL}/verify_contacts.php`, { phone_numbers: numbers }, { timeout: 15000 });
      if (res.data?.success) setContacts(res.data.matched_users || []);
    } catch {}
  };

  const fetchDashboard = async () => {
    setLoading(true);
    await hydrateFromLocal();
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await axios.post(`${BASE_URL}/dashboard.php`, { token }, { timeout: 10000 });
      if (res.data?.success) {
        const d = res.data.data;
        setBalance(d.wallet?.balance ?? '-');
        setCurrency(d.wallet?.currency ?? 'K');
        setTransactions(d.transactions ?? []);
        setPhone(d.phone_number ?? '');
        await saveDashboardData(res.data);
        await saveTransactions(JSON.stringify(d.transactions ?? []));
      }
    } catch {}
    finally { setLoading(false); }
  };

  const fetchMarketplace = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const rows = await marketplaceHistory(50);
      setHistory(rows.map(marketplaceActivity));
    } catch {}
  };

  const fetchNudges = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await listNudges(20);
      setNudges(data.notifications);
      setUnreadCount(data.unread_count);
      const stored = await SecureStore.getItemAsync('seen_nudge_ids');
      const ids = data.notifications.map((n: any) => Number(n.id)).filter(Boolean);
      const seen = new Set<number>(stored ? JSON.parse(stored) : ids);
      const fresh = data.notifications.filter((n: any) => !seen.has(Number(n.id)) && !n.read).slice(0, 2);
      if (fresh.length) {
        try {
          const permission = await Notifications.getPermissionsAsync();
          const granted = permission.status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
          if (granted) {
            for (const nudge of fresh) {
              await Notifications.scheduleNotificationAsync({
                content: { title: nudge.title || 'Payreece', body: nudge.body || 'You have a new update.', data: nudge.payload || {} },
                trigger: null,
              });
            }
          }
        } catch {}
      }
      const allIds = Array.from(new Set([...seen, ...ids]));
      await SecureStore.setItemAsync('seen_nudge_ids', JSON.stringify(allIds.slice(-200)));
    } catch {}
  };

  const allActivity = useMemo(
    () => [...transactions, ...history].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [transactions, history],
  );

  const openNudge = async (nudge: any) => {
    try {
      await markNudgesRead([nudge.id]);
      setNudges((current) => current.map((n: any) => n.id === nudge.id ? { ...n, read: true } : n));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {}
    const payload = nudge.payload || {};
    if (payload.screen === 'agent.request' || payload.offer_id) router.push('/agent/dashboard');
    else if (payload.transaction_id) router.push({ pathname: '/marketplace/transaction', params: { transaction_id: String(payload.transaction_id), role: String(payload.role || 'customer') } });
    else if (payload.request_id) router.push('/marketplace');
    else router.push('/transactions');
  };

  const markAllNudges = async () => {
    try {
      await markNudgesRead();
      setNudges((current) => current.map((n: any) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const fetchDashboardRef = useRef(fetchDashboard);
  const syncContactsRef = useRef(syncContacts);
  const fetchMarketplaceRef = useRef(fetchMarketplace);
  const fetchNudgesRef = useRef(fetchNudges);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDashboardRef.current();
      void syncContactsRef.current();
      void fetchMarketplaceRef.current();
      void fetchNudgesRef.current();
    }, 0);
    const i = setInterval(() => { void fetchDashboardRef.current(); void fetchMarketplaceRef.current(); }, 60000);
    const n = setInterval(() => { void fetchNudgesRef.current(); }, 20000);
    return () => { clearTimeout(timer); clearInterval(i); clearInterval(n); };
  }, []);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboard(), fetchMarketplace(), fetchNudges()]);
    setRefreshing(false);
  };

  const goSend = (c: any) => router.push({ pathname: '/send_funds', params: { id: c.public_id, name: c.fullname, phone_number: c.phone_number, avatar: c.avatar } });

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.tint} />}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        <LinearGradient colors={t.heroGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.glowA} /><View style={styles.glowB} />
          <View style={styles.topBar}>
            <View style={styles.brandRow}><Ionicons name="flash" size={18} color="#fff" /><Text style={styles.brand}>Payreece</Text></View>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Pressable onPress={() => router.push('/transactions')} style={styles.heroIcon}>
                <Ionicons name="time-outline" size={20} color="#fff" />
                {unreadCount > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
              </Pressable>
            )}
          </View>

          <Animated.View entering={FadeInDown.duration(420)}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Text style={styles.balance}>{currency} {balance}</Text>
            <View style={styles.heroMeta}>
              <View style={styles.metaPill}><Text style={styles.metaText}>{phone ? `•••• ${phone.slice(-4)}` : 'Wallet'}</Text></View>
              {transactions[0] ? <Text style={styles.metaSub}>Updated {formatDistanceToNow(new Date(transactions[0].date), { addSuffix: true })}</Text> : null}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.actionsRow}>
            {[
              { icon: 'add', label: 'Add', onPress: () => router.push('/deposit_funds') },
              { icon: 'arrow-up', label: 'Send', onPress: () => router.push('/(tabs)/explore') },
              { icon: 'arrow-down', label: 'Receive', onPress: () => router.push('/receive') },
              { icon: 'grid-outline', label: 'More', onPress: () => router.push('/marketplace') },
            ].map((a) => (
              <Pressable key={a.label} onPress={a.onPress} style={styles.actionItem}>
                <View style={styles.actionIcon}><Ionicons name={a.icon as any} size={20} color="#fff" /></View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </LinearGradient>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(120).duration(420)}>
            <GlassCard style={styles.sectionCard}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Quick send</Text>
                <Pressable onPress={() => router.push('/contacts')}><Text style={{ color: t.tint, fontWeight: '600' }}>See all</Text></Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                <Pressable onPress={() => router.push('/(tabs)/explore')} style={styles.person}>
                  <View style={[styles.personAdd, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}><Ionicons name="add" size={22} color={t.tint} /></View>
                  <Text style={[styles.personName, { color: t.textSecondary }]}>New</Text>
                </Pressable>
                {contacts.map((c, i) => (
                  <Pressable key={c.public_id || i} onPress={() => goSend(c)} style={styles.person}>
                    <Image source={avatars[`avatar${(i % 3) + 1}`]} style={styles.personAvatar} />
                    <Text style={[styles.personName, { color: t.textSecondary }]} numberOfLines={1}>{(c.fullname || 'User').split(' ')[0]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </GlassCard>
          </Animated.View>

          {nudges.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(160).duration(420)}>
              <GlassCard style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionTitle, { color: t.text }]}>Updates</Text>
                  {unreadCount > 0 ? <Pressable onPress={() => void markAllNudges()}><Text style={{ color: t.tint, fontWeight: '600' }}>Mark all read</Text></Pressable> : null}
                </View>
                {nudges.slice(0, 3).map((nudge) => (
                  <Pressable key={nudge.id} onPress={() => void openNudge(nudge)} style={[styles.nudgeRow, !nudge.read && { backgroundColor: t.accentSoftBg }]}>
                    <View style={[styles.txIcon, { backgroundColor: t.accentSoftBg }]}>
                      <Ionicons name="notifications-outline" size={18} color={t.tint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txTitle, { color: t.text }]} numberOfLines={1}>{nudge.title}</Text>
                      <Text style={[styles.txDate, { color: t.textMuted }]} numberOfLines={1}>{nudge.body}</Text>
                    </View>
                    {!nudge.read ? <View style={[styles.unreadDot, { backgroundColor: t.tint }]} /> : null}
                  </Pressable>
                ))}
              </GlassCard>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(180).duration(420)}>
            <GlassCard style={styles.sectionCard}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Recent activity</Text>
                <Pressable onPress={() => router.push('/transactions')}><Text style={{ color: t.tint, fontWeight: '600' }}>See all</Text></Pressable>
              </View>
              {allActivity.length === 0 ? <NoTransactions onDepositPress={() => router.push('/deposit_funds')} /> : allActivity.map((tx, i) => {
                const isMarketplace = tx.type === 'marketplace';
                const isTransfer = tx.type === 'transfer' || tx.type === 'sent' || tx.type === 'received';
                const counterparty = tx.other_sender_name || tx.other_sender_number;
                const incoming = isMarketplace ? !tx.from_me : tx.type === 'deposit' || (isTransfer && !tx.from_me);
                const title = isMarketplace ? tx.title : tx.type === 'deposit' ? 'Deposit' : isTransfer ? (tx.from_me ? `Sent to ${counterparty || 'recipient'}` : `From ${counterparty || 'sender'}`) : 'Transaction';
                const onPress = isMarketplace
                  ? () => router.push({ pathname: '/marketplace/map', params: { transaction_id: String(tx.transaction_id || ''), role: tx.role } })
                  : () => router.push({ pathname: '/transaction', params: tx });
                return (
                  <Pressable key={tx.id || i} onPress={onPress} style={[styles.txRow, i < allActivity.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
                    <View style={[styles.txIcon, { backgroundColor: incoming ? t.successSoft : t.accentSoftBg }]}>
                      <Feather name={incoming ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={incoming ? t.success : t.tint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txTitle, { color: t.text }]} numberOfLines={1}>{title}</Text>
                      <Text style={[styles.txDate, { color: t.textMuted }]}>{tx.date ? formatDistanceToNow(new Date(tx.date), { addSuffix: true }) : ''}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: incoming ? t.success : t.text }]}>{incoming ? '+' : '-'}{currency}{tx.amount}</Text>
                  </Pressable>
                );
              })}
            </GlassCard>
          </Animated.View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' },
  glowA: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 },
  glowB: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(10,132,255,0.20)', bottom: -40, left: -30 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  heroIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  notificationBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ff4d6d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  balanceLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 6 },
  balance: { color: '#fff', fontSize: 40, fontWeight: '700', letterSpacing: -1 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  metaPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  metaText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  metaSub: { color: 'rgba(255,255,255,0.62)', fontSize: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  actionItem: { alignItems: 'center', gap: 8, flex: 1 },
  actionIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '600' },
  body: { padding: 4, paddingTop: 20, gap: 14, marginTop: -14 },
  sectionCard: { },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom : 10},
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  peopleRow: { paddingHorizontal: 10, paddingBottom: 10, gap: 16 },
  person: { alignItems: 'center', width: 60, gap: 8 },
  personAdd: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  personAvatar: { width: 54, height: 54, borderRadius: 27 },
  personName: { fontSize: 12, fontWeight: '500' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10 },
  txIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  nudgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
