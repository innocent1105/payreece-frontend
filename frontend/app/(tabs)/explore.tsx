import { BASE_URL } from '@/constants/api';
import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ExploreScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'send' | 'deposit'>('send');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [balance, setBalance] = useState('-');
  const [currency, setCurrency] = useState('K');

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('dashboard_data');
        if (stored) {
          const d = JSON.parse(stored)?.data;
          setBalance(d?.wallet?.balance ?? '-');
          setCurrency(d?.wallet?.currency ?? 'K');
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!search || search.length < 3) {
      const id = setTimeout(() => { if (mounted) { setUsers([]); setVerifying(false); } }, 0);
      return () => { mounted = false; clearTimeout(id); };
    }
    const verifyTimer = setTimeout(() => { if (mounted) setVerifying(true); }, 0);
    axios.post(`${BASE_URL}/verify_number.php`, { phone_number: search }, { timeout: 10000 })
      .then(res => { if (mounted && res.data?.success) setUsers(res.data.users || []); else if (mounted) setUsers([]); })
      .catch(() => { if (mounted) setUsers([]); })
      .finally(() => { if (mounted) setVerifying(false); });
    return () => { mounted = false; clearTimeout(verifyTimer); };
  }, [search]);

  const network = (phone: string) => {
    const p = (phone || '').replace(/\s/g, '').replace('+26', '').substring(0, 3);
    if (['096', '076'].includes(p)) return 'MTN';
    if (['097', '077'].includes(p)) return 'Airtel';
    if (['095', '075'].includes(p)) return 'Zamtel';
    return 'Mobile';
  };

  const select = (u: any) => router.push({ pathname: '/send_funds', params: { id: u.p_id || u.public_id || 'unknown', name: u.fullname || u.username || 'Unknown', phone_number: u.phone_number, avatar: u.avatar || 'default.jpg' } });

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        <ScreenHero title="Actions" subtitle={`${currency} ${balance} available`} />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(380)}>
            <GlassCard style={{ padding: 6 }}>
              <View style={[styles.seg, { backgroundColor: t.inputBg }]}>
                {(['send', 'deposit'] as const).map(k => {
                  const active = tab === k;
                  return (
                    <Pressable key={k} onPress={() => setTab(k)} style={[styles.segBtn, active && { backgroundColor: t.surface, shadowColor: t.cardShadow }]}>
                      <Text style={{ color: active ? t.text : t.textMuted, fontWeight: '600', textTransform: 'capitalize' }}>{k}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </Animated.View>

          {tab === 'deposit' ? (
            <Animated.View entering={FadeInDown.delay(60).duration(380)}>
              <GlassCard>
                <Text style={[styles.title, { color: t.text }]}>Add money</Text>
                <Text style={[styles.sub, { color: t.textSecondary }]}>Top up your wallet instantly with mobile money.</Text>
                <Pressable onPress={() => router.push('/deposit_funds')} style={[styles.primaryAction, { backgroundColor: t.tint }]}>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.primaryActionText}>Continue to deposit</Text>
                </Pressable>
              </GlassCard>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(60).duration(380)}>
              <GlassCard>
                <Text style={[styles.title, { color: t.text }]}>Send to someone</Text>
                <View style={[styles.search, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                  <Ionicons name="search" size={18} color={t.textMuted} />
                  <TextInput style={[styles.searchInput, { color: t.text }]} placeholder="Search phone number" placeholderTextColor={t.textMuted} value={search} onChangeText={setSearch} keyboardType="phone-pad" />
                  {verifying ? <ActivityIndicator size="small" color={t.tint} /> : null}
                </View>

                {users.map((u, i) => (
                  <Pressable key={u.public_id || u.p_id || i} onPress={() => select(u)} style={[styles.userRow, i < users.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
                    <Image source={{ uri: `${BASE_URL}/view_pp.php?file=${u.avatar || 'default.jpg'}` }} style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { color: t.text }]}>{u.fullname || u.username}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 13 }}>{u.phone_number}</Text>
                    </View>
                    <View style={[styles.netPill, { backgroundColor: t.accentSoftBg }]}><Text style={{ color: t.tint, fontSize: 12, fontWeight: '600' }}>{network(u.phone_number)}</Text></View>
                  </Pressable>
                ))}

                {search.length > 9 && !verifying && users.length === 0 ? (
                  <Pressable onPress={() => select({ phone_number: search, fullname: search, p_id: 'unknown', avatar: 'default.jpg' })} style={styles.userRow}>
                    <View style={[styles.avatar, { backgroundColor: t.accentSoftBg, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="person-outline" size={20} color={t.tint} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { color: t.text }]}>{search}</Text>
                      <Text style={{ color: t.textMuted, fontSize: 13 }}>Send to number</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
                  </Pressable>
                ) : null}

                {!search ? <Text style={[styles.hint, { color: t.textMuted }]}>Enter a phone number to find a recipient.</Text> : null}
              </GlassCard>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, marginTop: -24 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  primaryAction: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.md },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 50, marginTop: 14, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontSize: 15, fontWeight: '600' },
  netPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  hint: { fontSize: 14, textAlign: 'center', paddingVertical: 18 },
});
