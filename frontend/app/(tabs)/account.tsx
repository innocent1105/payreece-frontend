import { BASE_URL } from '@/constants/api';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#2A2A68'; 
const ACCENT_COLOR = '#4169E1'; 
const TEXT_COLOR = '#000';
const SUB_TEXT_COLOR = '#666';

interface SettingRowProps {
    iconName: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ iconName, label, value, onPress }) => (
    <TouchableOpacity style={settingsStyles.row} onPress={onPress}>
        <View style={settingsStyles.rowLeft}>
            <Ionicons name={iconName} size={20} color={TEXT_COLOR} style={settingsStyles.icon} />
            <Text style={settingsStyles.label}>{label}</Text>
        </View>
        
        {value ? (
            <Text style={settingsStyles.value}>{value}</Text>
        ) : (
            <Ionicons name="chevron-forward" size={20} color={SUB_TEXT_COLOR} />
        )}
    </TouchableOpacity>
);

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const [user_token, setUserToken] = useState(null);
    const [public_id, setPublicId] = useState("");
    const [full_name, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [gender, setGender] = useState("");
    const [avatar, setAvatar] = useState("");
    const [phone_number, setPhoneNumber] = useState("");
    const [currency, setCurrency] = useState("K");
    const [balance, setBalance] = useState("-");
    const [transactions, setLastTransactions]= useState([]);
    const [account_type, setAccountType] = useState("main");
    const [isLoading, setIsLoading] = useState(true); 
    const [profileData, setProfileData] = useState<any>(null); 
    
    const fetchLocalData = async () => {
        try {
            const stored = await SecureStore.getItemAsync("dashboard_data");
            if (!stored) return null;
            return JSON.parse(stored);
        } catch (e) {
            console.error("Failed to load local data", e);
            return null;
        }
    };


    useEffect(() => {
        (async () => {
          const userLocalData = await fetchLocalData();
    
          if (userLocalData?.data) {
            const d = userLocalData.data;
            
            console.log("fetched profile data:", d);

            setProfileData(d);
            setPhoneNumber(d.phone_number ?? "");
            setAccountType(d.wallet?.type ?? d.wallet?.main ?? "main");
            setPublicId(d.public_id ?? "");
            setFullName(d.full_name ?? "");
            setEmail(d.email ?? "");
            setUsername(d.username ?? "");
            setGender(d.gender ?? "");
            
            if(d.avatar == null){
                setAvatar("avatar1.jpg");
            }else{
                setAvatar(d.avatar);
            }
            setBalance(d.wallet?.balance ?? "-");
            setCurrency(d.wallet?.currency ?? "K");
          }
    
        })();
    }, []);

    
    return (
        <ThemedView style={{ flex: 1 }}>
            <StatusBar style="auto" />
            
            <ScrollView contentContainerStyle={[
                settingsStyles.scrollContent, 
                { paddingBottom: insets.bottom + 10 }
            ]}>
                
                <View style={settingsStyles.profileHeader}>
                    <Image 
                        source={{ uri: `${BASE_URL}/view_pp.php?file=${avatar}` }} 
                        style={settingsStyles.profileImage} 
                    />
                    <Text style={settingsStyles.name}>
                        {full_name}
                    </Text>
                    <Text style={settingsStyles.email}>
                        @{username}
                    </Text>
                    
                    <TouchableOpacity style={settingsStyles.editButton} onPress={() => router.push('/edit_profile')}>
                        <Text style={settingsStyles.editButtonText}>Edit profile</Text>
                    </TouchableOpacity>
                </View>
                
                {/* 2. Payment Info Section */}
                <View style={settingsStyles.card}>
                    <Text style={settingsStyles.cardTitle}>Payment info</Text>
                    
                    <SettingRow 
                        iconName="card-outline" 
                        label="Payment methods" 
                        onPress={() => router.push('/payment_methods')} 
                    />
                    
                    {/* <SettingRow 
                        iconName="wallet-outline" 
                        label="My Cards" 
                        onPress={() => router.push('/cards')} 
                    /> */}
                </View>

          
                <View style={settingsStyles.card}>
                    <Text style={settingsStyles.cardTitle}>Settings</Text>
                    
                    {/* <SettingRow 
                        iconName="text-outline" 
                        label="Language" 
                        value="English"
                    />
                    
                    <SettingRow 
                        iconName="moon-outline" 
                        label="Theme" 
                        value="Light"
                    /> */}

                    <SettingRow 
                        iconName="eye-off-outline" 
                        label="Privacy settings" 
                        onPress={() => router.push('/privacy_settings')} 
                    />

                    <SettingRow 
                        iconName="notifications-outline" 
                        label="Notifications" 
                        value="Enabled"
                    />

                    

                    {/* <SettingRow 
                        iconName="headset-outline" 
                        label="Contact support"
                        onPress={() => console.log('Open support chat')}
                    /> */}
                </View>

                
                <View style={settingsStyles.card}>
                    <Text style={settingsStyles.cardTitle}>Account sign out</Text>
                  
                    <SettingRow 
                        iconName="log-out-outline" 
                        label="Log out"
                        onPress={async () => {
                            try {
                                console.log('logging out');

                                await SecureStore.deleteItemAsync('token');
                                await SecureStore.deleteItemAsync('dashboard_data');
                                await SecureStore.deleteItemAsync('payper-token');
                                await SecureStore.deleteItemAsync('p-transactions');

                                await AsyncStorage.clear();

                            } catch (e) {
                                console.warn('Failed to clear storage', e);
                            } finally {
                                router.replace('/login');
                            }
                        }}

                    />

                </View>

                <View style={settingsStyles.footer}>
                    <Text style={settingsStyles.footerText}>Payper - Pay as you learn</Text>
                    {/* <Text style={settingsStyles.footerText}>From Cynite</Text> */}
                </View>
              

            </ScrollView>
        </ThemedView>
    );
}

const settingsStyles = StyleSheet.create({
    scrollContent: {
        paddingTop: 0,
        paddingHorizontal: 20,
        backgroundColor: '#f8f8f8', 
    },
    
    footer : {
        textAlign : 'center',
        marginBottom: 90,
    },
    footerText : {
        textAlign : 'center',
        fontSize: 14,
        fontWeight: '700',
        color: "#aac",
    },
   
    profileHeader: {
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom :30,
        backgroundColor: '#fff',
        marginHorizontal: -20, 
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
        marginTop : 20
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: "#B0C4DE",
        marginBottom: 10,
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: TEXT_COLOR,
    },
    email: {
        fontSize: 14,
        color: SUB_TEXT_COLOR,
        marginBottom: 15,
    },
    editButton: {
        borderWidth: 1,
        borderColor: ACCENT_COLOR,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    editButtonText: {
        color: ACCENT_COLOR,
        fontWeight: '600',
    },

    card: {
        backgroundColor: '#fff',
        borderRadius: 15,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: SUB_TEXT_COLOR,
        paddingTop: 10,
        paddingBottom: 15,
        paddingLeft: 5,
    },
    
    // --- Row Styles ---
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 5,
        // Separator between rows (optional, but good practice)
        borderTopWidth: 1, 
        borderTopColor: '#f5f5f5', 
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        marginRight: 10,
    },
    label: {
        fontSize: 15,
        color: TEXT_COLOR,
        fontWeight: '500',
    },
    value: {
        fontSize: 15,
        color: SUB_TEXT_COLOR,
    },
});