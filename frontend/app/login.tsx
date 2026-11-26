import { BASE_URL } from '@/constants/api';
import { saveToken } from '@/components/auth/auth';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-theme-color';
import { AppButton } from '@/components/ui/app-button';
import { GlassCard } from '@/components/ui/glass-card';
import { Radius } from '@/constants/theme';

export default function LoginScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = phone.length >= 10 && password.length === 6;

  const handleLogin = async () => {
    if (!valid) return;
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/login.php`, { mobile_number: phone, password }, { timeout: 10000 });
      if (res.data?.success && res.data?.token) {
        await saveToken(res.data.token);
        router.replace('/');
      } else setError(res.data?.message || 'Unable to sign in.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Network error. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <LinearGradient colors={t.heroGradient as any} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.glow} />
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.brandIcon}><Ionicons name="flash" size={24} color="#fff" /></View>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSub}>Sign in to your Payreece account.</Text>
        </Animated.View>
      </LinearGradient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <GlassCard style={styles.card}>
              {error ? <View style={[styles.errorBox, { backgroundColor: t.dangerSoft, borderColor: t.danger }]}><Text style={{ color: t.danger, fontSize: 14 }}>{error}</Text></View> : null}
              <Text style={[styles.label, { color: t.textSecondary }]}>Phone number</Text>
              <View style={[styles.inputWrap, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                <Ionicons name="call-outline" size={20} color={t.textMuted} />
                <TextInput style={[styles.input, { color: t.text }]} placeholder="Mobile number" placeholderTextColor={t.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={15} />
              </View>
              <Text style={[styles.label, { color: t.textSecondary }]}>PIN</Text>
              <View style={[styles.inputWrap, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                <Ionicons name="lock-closed-outline" size={20} color={t.textMuted} />
                <TextInput style={[styles.input, { color: t.text }]} placeholder="6-digit PIN" placeholderTextColor={t.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPw} keyboardType="numeric" maxLength={6} />
                <Pressable onPress={() => setShowPw(v => !v)}><Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.textMuted} /></Pressable>
              </View>
              <AppButton label="Sign in" onPress={handleLogin} loading={loading} disabled={!valid} style={{ marginTop: 8 }} />
              <View style={styles.footerRow}>
                <Text style={{ color: t.textSecondary }}>New here?</Text>
                <Pressable onPress={() => router.replace('/register')}><Text style={{ color: t.tint, fontWeight: '600' }}> Create account</Text></Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingBottom: 48, overflow: 'hidden' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -40 },
  brandIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 16, marginTop: 8 },
  content: { padding: 20, marginTop: -24 },
  card: { padding: 20 },
  errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 52, marginBottom: 14 },
  input: { flex: 1, fontSize: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
});
