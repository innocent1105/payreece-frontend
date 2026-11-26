import { BASE_URL } from '@/constants/api';
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

type Gender = 'male' | 'female' | '';
type Role = 'user' | 'agent';

export default function RegisterScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [role, setRole] = useState<Role>('user');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = fullName.trim().length >= 4 && phone.length >= 10 && !!gender && password.length === 6 && password === confirm;

  const onRegister = async () => {
    if (!valid) { setError('Please complete all fields correctly.'); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${BASE_URL}/register.php`, { username: fullName.trim(), mobile_number: phone.trim(), gender, password, role }, { timeout: 10000 });
      if (res.data?.success) router.push('/login');
      else setError(res.data?.message || 'Registration failed.');
    } catch (e: any) {
      const message = e?.response?.data?.message
        || (e?.code === 'ECONNABORTED' ? 'The server took too long to respond. Please try again.' : e?.message);
      setError(message || 'Unable to register right now. Please try again.');
    }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <LinearGradient colors={t.heroGradient as any} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.heroTitle}>Create account</Text>
          <Text style={styles.heroSub}>Set up your Payreece wallet in minutes.</Text>
        </Animated.View>
      </LinearGradient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <GlassCard style={styles.card}>
              {error ? <View style={[styles.errorBox, { backgroundColor: t.dangerSoft, borderColor: t.danger }]}><Text style={{ color: t.danger }}>{error}</Text></View> : null}
              <Field icon="person-outline" placeholder="Full name" value={fullName} onChangeText={setFullName} colors={t} />
              <Field icon="call-outline" placeholder="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={15} colors={t} />
              <Text style={[styles.label, { color: t.textSecondary }]}>Account type</Text>
              <View style={styles.genderRow}>
                {([
                  { key: 'user', label: 'User', icon: 'person-outline' },
                  { key: 'agent', label: 'Agent', icon: 'storefront-outline' },
                ] as const).map((item) => {
                  const active = role === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setRole(item.key)}
                      style={[styles.genderBtn, { backgroundColor: active ? t.accentSoftBg : t.inputBg, borderColor: active ? t.tint : t.inputBorder }]}
                    >
                      <Ionicons name={item.icon} size={17} color={active ? t.tint : t.textMuted} />
                      <Text style={{ color: active ? t.tint : t.textSecondary, fontWeight: '700', marginTop: 4 }}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.label, { color: t.textSecondary }]}>Gender</Text>
              <View style={styles.genderRow}>
                {(['male', 'female'] as const).map(g => {
                  const active = gender === g;
                  return (
                    <Pressable key={g} onPress={() => setGender(g)} style={[styles.genderBtn, { backgroundColor: active ? t.accentSoftBg : t.inputBg, borderColor: active ? t.tint : t.inputBorder }]}>
                      <Text style={{ color: active ? t.tint : t.textSecondary, fontWeight: '600', textTransform: 'capitalize' }}>{g}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Field icon="key-outline" placeholder="Create 6-digit PIN" value={password} onChangeText={setPassword} keyboardType="numeric" secureTextEntry maxLength={6} colors={t} />
              <Field icon="lock-closed-outline" placeholder="Confirm PIN" value={confirm} onChangeText={setConfirm} keyboardType="numeric" secureTextEntry maxLength={6} colors={t} />
              {password.length > 0 && confirm.length > 0 && password !== confirm ? <Text style={{ color: t.danger, marginBottom: 10, fontSize: 13 }}>PINs do not match.</Text> : null}
              <AppButton label="Create account" onPress={onRegister} loading={loading} disabled={!valid} />
              <View style={styles.footerRow}>
                <Text style={{ color: t.textSecondary }}>Already have an account?</Text>
                <Pressable onPress={() => router.replace('/login')}><Text style={{ color: t.tint, fontWeight: '600' }}> Sign in</Text></Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ icon, placeholder, value, onChangeText, keyboardType, secureTextEntry, maxLength, colors }: any) {
  return (
    <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingBottom: 44 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 16, marginTop: 8 },
  content: { padding: 20, marginTop: -24, paddingBottom: 40 },
  card: { padding: 20 },
  errorBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 52, marginBottom: 14 },
  input: { flex: 1, fontSize: 16 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  genderBtn: { flex: 1, minHeight: 46, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
});
