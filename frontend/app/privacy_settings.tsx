import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


type SettingRowProps = {
  icon: any;
  title: string;
  subtitle: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  isToggle?: boolean;
};

const SettingRow = ({ icon, title, subtitle, value, onValueChange, isToggle = true }: SettingRowProps) => (
  <View style={styles.settingRow}>
    <View style={styles.iconContainer}>
      <Feather name={icon} size={22} color="#475569" />
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    {isToggle ? (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E2E8F0', true: '#0066FF' }}
        thumbColor="#FFFFFF"
      />
    ) : (
      <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    )}
  </View>
);

const PrivacySettingsScreen = () => {
  const [isProfilePublic, setIsProfilePublic] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [dataSharing, setDataSharing] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={()=> {router.back()}} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Privacy Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account Privacy</Text>
          <View style={styles.flatCard}>
            <SettingRow 
              icon="user"
              title="Public Profile" 
              subtitle="Allow others to find your profile"
              value={isProfilePublic}
              onValueChange={setIsProfilePublic}
            />
            <View style={styles.divider} />
            <SettingRow 
              icon="shield"
              title="Two-Factor Auth" 
              subtitle="Secure your account with 2FA"
              value={twoFactor}
              onValueChange={setTwoFactor}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data & Security</Text>
          <View style={styles.flatCard}>
            <SettingRow 
              icon="database"
              title="Usage Data" 
              subtitle="Share anonymous usage statistics"
              value={dataSharing}
              onValueChange={setDataSharing}
            />
            <View style={styles.divider} />
            <TouchableOpacity activeOpacity={0.7}>
              <SettingRow 
                icon="eye-off"
                title="Blocked Users" 
                subtitle="Manage your blocked list"
                isToggle={false}
              />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity activeOpacity={0.7}>
              <SettingRow 
                icon="trash-2"
                title="Delete Account" 
                subtitle="Permanently remove your data"
                isToggle={false}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
        
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  flatCard: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 20,
    paddingVertical: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  saveButton: {
    backgroundColor: '#0F172A', 
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PrivacySettingsScreen;