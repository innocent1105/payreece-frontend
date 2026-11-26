import { BASE_URL } from '@/constants/api';
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
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditProfile() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<any>({ full_name: '', username: '', email: '', gender: '', avatar: 'avatar1.jpg', phone_number: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const stored = await SecureStore.getItemAsync('dashboard_data');
    if (stored) { const d = JSON.parse(stored)?.data || {}; setForm({ full_name: d.full_name || '', username: d.username || '', email: d.email || '', gender: d.gender || '', avatar: d.avatar || 'avatar1.jpg', phone_number: d.phone_number || '' }); }
  })(); }, []);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]) setForm((f: any) => ({ ...f, avatarBase64: res.assets[0].base64, avatarUri: res.assets[0].uri }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.post(`${BASE_URL}/update_profile.php`, form, { timeout: 10000 });
      const stored = await SecureStore.getItemAsync('dashboard_data');
      if (stored) { const j = JSON.parse(stored); j.data = { ...j.data, ...form }; await SecureStore.setItemAsync('dashboard_data', JSON.stringify(j)); }
      router.back();
    } catch {} finally { setSaving(false); }
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
            <AppButton label="Save changes" onPress={save} loading={saving} />
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
});
