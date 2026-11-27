import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import { GlassCard } from '@/components/ui/glass-card';
import { ScreenHero } from '@/components/ui/screen-hero';
import { AppButton } from '@/components/ui/app-button';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ProfileForm = {
  full_name: string;
  username: string;
  email: string;
  gender: string;
  avatar: string;
  phone_number: string;
  avatarBase64?: string;
  avatarUri?: string;
  avatarMime?: string;
};

const emptyForm: ProfileForm = { full_name: '', username: '', email: '', gender: '', avatar: 'avatar1.jpg', phone_number: '' };

const formSignature = (form: ProfileForm) => JSON.stringify({
  full_name: form.full_name,
  username: form.username,
  email: form.email,
  gender: form.gender,
  phone_number: form.phone_number,
  avatarBase64: form.avatarBase64 ?? null,
});

export default function EditProfile() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [status, setStatus] = useState('');
  const loadedRef = useRef(false);
  const lastSavedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { (async () => {
    const stored = await SecureStore.getItemAsync('dashboard_data');
    if (stored) {
      const d = JSON.parse(stored)?.data || {};
      const next: ProfileForm = {
        full_name: d.full_name || d.fullname || '',
        username: d.username || '',
        email: d.email || '',
        gender: d.gender || '',
        avatar: d.avatar || 'avatar1.jpg',
        phone_number: d.phone_number || '',
      };
      lastSavedRef.current = formSignature(next);
      setForm(next);
    }
    loadedRef.current = true;
  })(); }, []);

  const saveProfile = useCallback(async (snapshot: ProfileForm) => {
    const token = await getToken();
    if (!token) {
      setStatus('Please sign in again.');
      return;
    }
    setStatus('Saving...');
    try {
      const body: Record<string, string> = {
        token,
        fullname: snapshot.full_name.trim(),
        username: snapshot.username.trim(),
        email: snapshot.email.trim(),
        gender: snapshot.gender,
        phone_number: snapshot.phone_number.trim(),
      };
      if (snapshot.avatarBase64) {
        body.avatar = `data:${snapshot.avatarMime || 'image/jpeg'};base64,${snapshot.avatarBase64}`;
      }
      const res = await axios.post(`${BASE_URL}/update_profile.php`, body, { timeout: 10000 });
      if (!res.data?.success) throw new Error(res.data?.message || 'Could not save.');
      const updated = res.data.updated_user || {};
      const stored = await SecureStore.getItemAsync('dashboard_data');
      if (stored) {
        const json = JSON.parse(stored);
        json.data = {
          ...(json.data || {}),
          ...updated,
          full_name: updated.full_name || updated.fullname || snapshot.full_name,
          fullname: updated.fullname || snapshot.full_name,
          avatar: updated.avatar || snapshot.avatar,
        };
        await SecureStore.setItemAsync('dashboard_data', JSON.stringify(json));
      }
      setForm((current) => {
        const next = {
          ...current,
          full_name: updated.full_name || updated.fullname || current.full_name,
          avatar: updated.avatar || current.avatar,
          avatarBase64: undefined,
          avatarUri: undefined,
          avatarMime: undefined,
        };
        lastSavedRef.current = formSignature(next);
        return next;
      });
      setStatus('Saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save changes.');
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const signature = formSignature(form);
    if (signature === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void saveProfile(form); }, 650);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [form, saveProfile]);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      setForm((f) => ({ ...f, avatarBase64: asset.base64 ?? undefined, avatarUri: asset.uri, avatarMime: asset.mimeType || 'image/jpeg' }));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <ScreenHero title="Edit profile" onBack={() => router.back()} compact />
        <View style={styles.body}>
          <GlassCard style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Pressable onPress={pick}>
              <Image source={{ uri: form.avatarUri || `${BASE_URL}/view_pp.php?file=${form.avatar}` }} style={styles.avatar} />
              <View style={[styles.cam, { backgroundColor: t.tint }]}><Ionicons name="camera" size={14} color="#fff" /></View>
            </Pressable>
            <Text style={{ color: t.textSecondary, marginTop: 10 }}>{form.phone_number}</Text>
          </GlassCard>
          <GlassCard>
            <ProfileField label="Full name" keyName="full_name" value={form.full_name} colors={t} onChangeText={(key: string, value: string) => setForm((f: any) => ({ ...f, [key]: value }))} />
            <ProfileField label="Username" keyName="username" value={form.username} colors={t} onChangeText={(key: string, value: string) => setForm((f: any) => ({ ...f, [key]: value }))} autoCapitalize="none" />
            <ProfileField label="Email" keyName="email" value={form.email} colors={t} onChangeText={(key: string, value: string) => setForm((f: any) => ({ ...f, [key]: value }))} keyboardType="email-address" autoCapitalize="none" />
            <Text style={[styles.label, { color: t.textSecondary }]}>Gender</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {['male', 'female'].map(g => {
                const active = form.gender === g;
                return <Pressable key={g} onPress={() => setForm((f: any) => ({ ...f, gender: g }))} style={[styles.gender, { backgroundColor: active ? t.accentSoftBg : t.inputBg, borderColor: active ? t.tint : t.inputBorder }]}><Text style={{ color: active ? t.tint : t.textSecondary, fontWeight: '600', textTransform: 'capitalize' }}>{g}</Text></Pressable>;
              })}
            </View>
            <Text style={[styles.status, { color: t.textMuted }]}>{status || 'Changes save automatically.'}</Text>
            <AppButton label="Done" onPress={() => router.back()} />
          </GlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileField({ label, keyName, value, colors, onChangeText, ...rest }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        value={value}
        onChangeText={(v) => onChangeText(keyName, v)}
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14, marginTop: -24 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  cam: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  gender: { flex: 1, minHeight: 46, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  status: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
});
