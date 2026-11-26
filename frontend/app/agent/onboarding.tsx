import { ErrorText, Field, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { getForegroundLocation } from '@/components/lib/agent-location';
import { MarketplaceError, marketplaceUpload } from '@/components/lib/marketplace';
import { ScreenHero } from '@/components/ui/screen-hero';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius } from '@/constants/theme';

const NETWORKS = ['MTN', 'AIRTEL', 'ZAMTEL'] as const;
type Network = typeof NETWORKS[number];
type DocKey = 'nrc_front' | 'nrc_back' | 'selfie';

export default function AgentOnboarding() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [nrc, setNrc] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [networks, setNetworks] = useState<Network[]>(['MTN']);
  const [documents, setDocuments] = useState<Partial<Record<DocKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async (key: DocKey) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setDocuments((current) => ({ ...current, [key]: result.assets[0].uri }));
    }
  };

  const toggleNetwork = (network: Network) => {
    setNetworks((current) => current.includes(network) ? current.filter((item) => item !== network) : [...current, network]);
  };

  const submit = async () => {
    if (businessName.trim().length < 3 || address.trim().length < 3 || nrc.trim().length < 6 || networks.length === 0) {
      setError('Complete the business name, address, NRC and at least one network.');
      return;
    }
    if (!documents.selfie || (!documents.nrc_front && !documents.nrc_back)) {
      setError('Add a selfie and at least one NRC photo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const location = await getForegroundLocation();
      const form = new FormData();
      form.append('business_name', businessName.trim());
      form.append('address_text', address.trim());
      form.append('nrc_number', nrc.trim().toUpperCase());
      form.append('vehicle_description', vehicle.trim());
      form.append('networks', JSON.stringify(networks));
      form.append('lat', String(location.lat));
      form.append('lng', String(location.lng));
      (['nrc_front', 'nrc_back', 'selfie'] as DocKey[]).forEach((key) => {
        const uri = documents[key];
        if (uri) {
          form.append(key, new File(uri), `${key}.jpg`);
        }
      });
      await marketplaceUpload('agent.register', form);
      router.replace('/agent/dashboard');
    } catch (err) {
      setError(err instanceof MarketplaceError ? err.message : 'Could not submit your agent application.');
      console.log(err)
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScreenHero title="Become an agent" subtitle="Verify your details to receive nearby requests" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, marginTop: -24, paddingBottom: insets.bottom + 24 }}>
        <SectionCard title="Business details">
          <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="e.g. Chibesa MoMo" />
          <Field label="Business address" value={address} onChangeText={setAddress} placeholder="Landmark or address" />
          <Field label="NRC number" value={nrc} onChangeText={setNrc} placeholder="e.g. 123456/12/1" />
          <Field label="Vehicle description" value={vehicle} onChangeText={setVehicle} placeholder="Optional" />
        </SectionCard>

        <SectionCard title="Networks">
          <InfoText>Choose the mobile money networks you can serve.</InfoText>
          <View style={styles.networks}>
            {NETWORKS.map((network) => {
              const active = networks.includes(network);
              return (
                <Pressable
                  key={network}
                  onPress={() => toggleNetwork(network)}
                  style={[styles.networkButton, { backgroundColor: active ? t.accentSoftBg : t.inputBg, borderColor: active ? t.tint : t.inputBorder }]}
                >
                  <Text style={{ color: active ? t.tint : t.textSecondary, fontWeight: '700' }}>{network}</Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard title="Verification photos">
          <InfoText>A selfie and at least one NRC photo are required. Your documents are stored privately.</InfoText>
          <View style={styles.documents}>
            {(['nrc_front', 'nrc_back', 'selfie'] as DocKey[]).map((key) => (
              <Pressable key={key} onPress={() => void pickImage(key)} style={[styles.documentBox, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                {documents[key] ? (
                  <Image source={{ uri: documents[key] }} style={styles.documentImage} contentFit="cover" />
                ) : (
                  <Ionicons name="camera-outline" size={22} color={t.textMuted} />
                )}
                <Text style={[styles.documentLabel, { color: t.textSecondary }]}>{key.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <ErrorText message={error} />
        <PrimaryButton label={loading ? 'Submitting...' : 'Submit application'} onPress={() => void submit()} disabled={loading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  networks: { flexDirection: 'row', gap: 8, marginTop: 12 },
  networkButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.sm, borderWidth: 1 },
  documents: { flexDirection: 'row', gap: 10, marginTop: 14 },
  documentBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 84, borderRadius: Radius.sm, borderWidth: 1, overflow: 'hidden', padding: 8 },
  documentImage: { width: '100%', height: 54, borderRadius: 8 },
  documentLabel: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', textAlign: 'center' },
});
