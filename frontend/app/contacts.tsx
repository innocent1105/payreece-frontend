import { ScreenHero } from '@/components/ui/screen-hero';
import { GlassCard } from '@/components/ui/glass-card';
import { useAppTheme } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ContactsScreen() {
  const t = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Contacts" onBack={() => router.back()} compact />
      <View style={styles.body}>
        <GlassCard style={{ alignItems: 'center', paddingVertical: 40 }}>
          <View style={[styles.icon, { backgroundColor: t.accentSoftBg }]}><Ionicons name="people-outline" size={34} color={t.tint} /></View>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 14 }}>Contacts</Text>
          <Text style={{ color: t.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>Matched contacts from your device will appear here.</Text>
        </GlassCard>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ body: { padding: 20, marginTop: -24 }, icon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' } });
