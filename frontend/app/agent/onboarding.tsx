import { getForegroundLocation } from '@/components/lib/agent-location';
import { marketplace, marketplaceUpload } from '@/components/lib/marketplace';
import { ErrorText, Field, InfoText, PrimaryButton, SectionCard } from '@/components/marketplace/ui';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PickedImage = { uri: string; name: string };

const SUPPORTED_NETWORKS = ['MTN', 'AIRTEL', 'ZAMTEL'];

export default function AgentOnboardingScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [nrc, setNrc] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [networks, setNetworks] = useState<string[]>(['MTN']);
  const [front, setFront] = useState<PickedImage | null>(null);
  const [back, setBack] = useState<PickedImage | null>(null);
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    marketplace('agent.profile')
      .then((data) => {
        setProfile(data);
        setBusinessName(data.business_name ?? '');
        setAddress(data.address_text ?? '');
        setNrc(data.nrc_number ?? '');
        setVehicle(data.vehicle_description ?? '');
        const selected = (data.networks ?? []).map((item: any) => item.network).filter(Boolean);
        if (selected.length) setNetworks(selected);
      })
      .catch(() => undefined);
    getForegroundLocation().catch((err) => setError(err.message));
  }, []);

  const pickImage = async (setter: (image: PickedImage | null) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setter({ uri: asset.uri, name: asset.fileName ?? 'document.jpg' });
    }
  };

  const toggleNetwork = (code: string) => {
    setNetworks((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const appendImage = (form: FormData, field: string, image: PickedImage | null) => {
    if (image) {
      form.append(field, { uri: image.uri, name: image.name, type: 'image/jpeg' } as any);
    }
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const location = await getForegroundLocation();
      const form = new FormData();
      form.append('business_name', businessName);
      form.append('address_text', address);
      form.append('nrc_number', nrc);
      form.append('vehicle_description', vehicle);
      form.append('lat', String(location.lat));
      form.append('lng', String(location.lng));
      form.append('networks', JSON.stringify(networks));
      appendImage(form, 'nrc_front', front);
      appendImage(form, 'nrc_back', back);
      appendImage(form, 'selfie', selfie);

      if (profile) {
        await marketplaceUpload('agent.profile', form, 'PUT');
      } else {
        await marketplaceUpload('agent.register', form);
      }
      router.push('/agent/dashboard');
    } catch (err: any) {
      setError(err.message || 'Could not save agent profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{profile ? 'Agent profile' : 'Become an agent'}</Text>
        <InfoText>Your application is reviewed before you can receive customer requests.</InfoText>

        <SectionCard title="Business details">
          <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Agent shop or business" />
          <Field label="Business address" value={address} onChangeText={setAddress} placeholder="Cairo Road, Lusaka" />
          <Field label="NRC number" value={nrc} onChangeText={(value) => setNrc(value.toUpperCase())} placeholder="123456/78/9" />
          <Field label="Vehicle description" value={vehicle} onChangeText={setVehicle} placeholder="Blue motorbike" />
          <Text style={styles.label}>Supported networks</Text>
          <View style={styles.networks}>
            {SUPPORTED_NETWORKS.map((code) => (
              <TouchableOpacity
                key={code}
                onPress={() => toggleNetwork(code)}
                style={[styles.networkChip, networks.includes(code) && styles.networkChipActive]}
              >
                <Text style={[styles.networkText, networks.includes(code) && styles.networkTextActive]}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Verification documents">
          <InfoText>JPG, PNG, or WEBP up to 5 MB. A selfie and at least one NRC photo are required.</InfoText>
          <DocumentButton label={front ? 'NRC front selected' : 'Choose NRC front'} onPress={() => pickImage(setFront)} />
          <DocumentButton label={back ? 'NRC back selected' : 'Choose NRC back (optional)'} onPress={() => pickImage(setBack)} />
          <DocumentButton label={selfie ? 'Selfie selected' : 'Choose selfie'} onPress={() => pickImage(setSelfie)} />
        </SectionCard>

        {profile?.verification_status === 'pending' && (
          <InfoText>Status: pending review. You can edit your details while you wait.</InfoText>
        )}
        {profile?.verification_status === 'rejected' && (
          <ErrorText message={`Application rejected: ${profile.rejection_reason ?? 'Contact support.'}`} />
        )}
        <ErrorText message={error} />
        <PrimaryButton label={loading ? 'Saving...' : profile ? 'Save profile' : 'Submit application'} onPress={submit} disabled={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.documentButton}>
      <Ionicons name="camera-outline" size={18} color="#4C6FFF" />
      <Text style={styles.documentText}>{label}</Text>
    </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  networks: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  networkChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  networkChipActive: {
    borderColor: '#4C6FFF',
    backgroundColor: '#EFF2FF',
  },
  networkText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  networkTextActive: {
    color: '#4C6FFF',
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
  },
  documentText: {
    color: '#374151',
    fontSize: 14,
  },
});
