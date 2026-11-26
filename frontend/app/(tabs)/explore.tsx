import { BASE_URL } from '@/constants/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios from "axios";
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const ACTIVE_COLOR = '#2A2A68'; 
const INACTIVE_COLOR = '#999';

interface ActionTabsProps {
    activeTab: 'deposit' | 'send' | 'receive';
    setActiveTab: (tab: 'deposit' | 'send' | 'receive') => void;
}


const ActionTabs: React.FC<ActionTabsProps> = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { key: 'deposit', label: 'Deposit' },
        { key: 'send', label: 'Send' },
        // { key: 'receive', label: 'Receive' },
    ];

    return (
        <View style={actionSheetStyles.tabContainer}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            actionSheetStyles.tabButton,
                            isActive && actionSheetStyles.activeTabButton,
                        ]}
                        onPress={() => setActiveTab(tab.key as 'deposit' | 'send' | 'receive')}
                    >
                        <Text style={[actionSheetStyles.tabText, { color: isActive ? '#fff' : '#000' }]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};



export default function ExploreScreen() {
    const user_data_token = "dashboard_data";
    const [balance, setBalance] = useState("00.00");
    const [currency, setCurrency] = useState("");
    const [activeTab, setActiveTab] = React.useState<'deposit' | 'send' >('send');
    // const [activeTab, setActiveTab] = React.useState<'deposit' | 'send' | 'receive'>('send');
    const [searchText, onChangeSearchText] = useState("");

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const storedData = await SecureStore.getItemAsync(user_data_token);

            if (!storedData) {
                console.log("No dashboard data found");
                return;
            }

                const parsedData = JSON.parse(storedData);
                console.log("dash balance:", parsedData.data.wallet.balance);

                setBalance(parsedData.data.wallet.balance);
                setCurrency(parsedData.data.wallet.currency);
            } catch (error) {
                console.error("Error loading dashboard data:", error);
            }
        };

        loadDashboardData();
    }, []);


    const [CONTACTS, setCONTACTS] = useState([
        // { 
        //     p_id: '1', 
        //     username: 'Innocent Mugwadi', 
        //     contact: '0960883940', 
        //     payperUser : true,
        //     selected : false,
        //     avatar : "",
        // }
    ]);

    const [FOUND_USERS, SETFOUNDUSERS] = useState([]);

    const getNetworkProvider = (phone) => {
        if (!phone) return "Unknown";
        
        const cleanPhone = phone.replace(/\s/g, '').replace('+26', '');
        const prefix = cleanPhone.substring(0, 3);

        if (['096', '076'].includes(prefix)) return "MTN";
        if (['097', '077'].includes(prefix)) return "Airtel";
        if (['095', '075'].includes(prefix)) return "Zamtel";
        
        return "Other";
    };

    const filteredContacts = CONTACTS.filter(contact => {
        const lowerSearchText = searchText.toLowerCase();
        
        const matchesUsername = contact.username.toLowerCase().includes(lowerSearchText);
        const matchesContact = contact.contact.toLowerCase().includes(lowerSearchText);
        
        return matchesUsername || matchesContact;
    });

    const isNumericSearch = searchText.length > 0 && /^[0-9]+$/.test(searchText);

    const showUnregisteredNumber = isNumericSearch && filteredContacts.length === 0;
    const [unregisteredName, setUnregisteredName] = useState("Not registered");
    const [verifying, setVerifying] = useState(true);
    const [userFound, setUserFound] = useState(true);

    const selectContact = async (phoneNumber : any, username : any, p_id : any, avatar : any)=>{
        console.log("selected : ", phoneNumber);
        console.log("selected : ",avatar)
        router.push({
            pathname: "/send_funds",
            params: { 
                id: p_id, 
                name: username,
                phone_number : phoneNumber,
                avatar : avatar
            }
        });
    }

   

    useEffect(()=>{
        const checkUserByPhone = async (phoneNumber: string) => {
            SETFOUNDUSERS([]);
            setVerifying(true);
            try {
                const response = await axios.post(`${BASE_URL}/verify_number.php`,{
                    phone_number: phoneNumber,},{
                    timeout: 10000,
                }
                );
                if(response.data.success){
                    const found_users = response.data.users;
                    SETFOUNDUSERS(found_users);

                    setVerifying(false);
                    console.log(found_users);
                }else{
                    console.log(searchText,"Not found from backend");
                }
            } catch (error: any) {
                console.error("Phone check failed:", error?.response || error);
                return {
                success: false,
                message: "Network or server error",
                };
            }finally {
                setVerifying(false);
            }
        }
        checkUserByPhone(searchText);
    }, [searchText])



    const renderActiveContent = () => {
        switch (activeTab) {
            case 'deposit':
                return (
                    <View style={actionSheetStyles.contentSectionDeposit}>
                        <Text style={actionSheetStyles.contentHeader}>Deposit From</Text>
                        <ActionDetailRow label="Processing Time" value="Instant" icon="time-outline" />
                    </View>
                );
            case 'send':
                return (
                    <View style={actionSheetStyles.contentSection}>
                        <Text style={actionSheetStyles.contentHeaderSend}>Search</Text>
        

                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Enter phone number"
                                placeholderTextColor={INACTIVE_COLOR}
                                value={searchText}
                                onChangeText={onChangeSearchText}
                            />
                        </View>
                        <ScrollView >
                            {filteredContacts.map((contact, index)=>(
                               <View key={index}>
                                    <TouchableOpacity onPress={()=>{
                                        selectContact(contact.contact, contact.username, contact.p_id, contact.avatar)
                                    }}>
                                        <View style={styles.transactionRow}>
                                            <Image source={{ uri: 'https://i.pravatar.cc/100?img=12' }} style={styles.transactionAvatar} />
                                            <View style={styles.transactionInfo}>
                                            <Text style={styles.transactionName}>
                                                {contact.username}
                                            </Text>
                                            <Text style={styles.transactionDate}>
                                                {contact.contact}
                                            </Text>
                                            </View>
                                            {contact.payperUser && (
                                                <View style={styles.activeUserOn}>
                                                </View>
                                            )}
                                            
                                        </View>
                                    </TouchableOpacity>
                               </View>
                            ))}

                            {showUnregisteredNumber && searchText.length > 2 && (
                                <View>
                                    {verifying && FOUND_USERS.length < 0 && (
                                        <View>
                                            <View style={styles.transactionRow}>
                                                <Image
                                                    source={{ uri: 'https://i.pravatar.cc/100?u=number' }}
                                                    style={styles.transactionAvatar}
                                                />
                                                <View style={styles.transactionInfo}>
                                                    <Text style={styles.transactionName}>
                                                        {searchText}
                                                    </Text>
                                                    <Text style={styles.transactionDate}>
                                                        {unregisteredName}
                                                    </Text>
                                                </View>

                                                <View >
                                                    <Text style={styles.verifyingText}>
                                                        <View style={styles.networkCard}>
                                                            <Text style={styles.network}>
                                                                 {getNetworkProvider(searchText)} • Verifying
                                                            </Text>
                                                        </View>
                                                    </Text>
                                                    
                                                    <View style={styles.verifyingLoader}>
                                                        <ActivityIndicator size={20} color={"#999"}/>
                                                    </View>
                                                </View>

                                            </View>
                                        </View>
                                    )}

                                    {FOUND_USERS.length > 0 ? (
                                        <View>
                                            {FOUND_USERS.map((found_user, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() => {
                                                        console.log("Sending to unregistered number:", searchText);
                                                        // router.push("../send_funds");
                                                        selectContact(found_user.phone_number, found_user.fullname, found_user.p_id, found_user.avatar)
                                                    }}
                                                >
                                                    <View style={styles.transactionRow}>
                                                        <Image  source={{ uri: `${BASE_URL}/view_pp.php?file=${found_user.avatar}` }}  style={styles.transactionAvatar} />
                                                        
                                                        <View style={styles.transactionInfo}>
                                                            <Text style={styles.transactionName}>
                                                                {found_user.fullname}
                                                            </Text>
                                                            <Text style={styles.transactionDate}>
                                                                {found_user.phone_number}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.networkCard}>
                                                            <Text style={styles.network}>
                                                                • {getNetworkProvider(found_user.phone_number)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : (
                                        <View>
                                            <Text style={styles.noUserFoundText}>No users found</Text>
                                           {searchText.length > 9 ? (
                                             <TouchableOpacity
                                                    onPress={() => {
                                                        console.log("Sending to unregistered number:", searchText);
                                                        selectContact(searchText, "unknown-user", "unknown","default.jpg");
                                                    }}
                                                >
                                                    <View style={styles.transactionRow}>
                                                        <Image source={require('../../assets/images/avatars/default.jpg')} style={styles.transactionAvatar} />
                                                        
                                                        <View style={styles.transactionInfo}>
                                                            <Text style={styles.transactionName}>
                                                                {searchText}
                                                            </Text>
                                                            <Text style={styles.transactionDate}>
                                                                Unknown
                                                            </Text>
                                                        </View>
                                                        <View style={styles.networkCard}>
                                                            <Text style={styles.network}>
                                                                • {getNetworkProvider(searchText)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                            </TouchableOpacity>
                                           ) : (
                                                <View>
                                                        <View style={styles.transactionRow}>
                                                            <Image source={require('../../assets/images/avatars/default.jpg')} style={styles.transactionAvatar} />
                                                            
                                                            <View style={styles.transactionInfo}>
                                                                <Text style={styles.transactionName}>
                                                                    {searchText}
                                                                </Text>
                                                                <Text style={styles.transactionDate}>
                                                                    Unknown
                                                                </Text>
                                                            </View>
                                                            <View style={styles.networkCard}>
                                                                <Text style={styles.network}>
                                                                    • {getNetworkProvider(searchText)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                </View>
                                           )}

                                        </View>
                                    )}

                                    
                                </View>
                            )}


                       
                        
                        </ScrollView>
                    </View>
                );

            case 'receive':
                return (
                    <View style={actionSheetStyles.contentSection}>
                        <Text style={actionSheetStyles.contentHeader}>Share QR Code</Text>
                        {/* Placeholder for QR Code */}
                        <View style={actionSheetStyles.qrCodePlaceholder}>
                             <Ionicons name="qr-code-outline" size={120} color={INACTIVE_COLOR} />
                             <Text style={{ color: INACTIVE_COLOR, marginTop: 10 }}>Scan to receive funds instantly</Text>
                        </View>
                        <ActionDetailRow label="Account ID" value="PZ-2025-5678" icon="key-outline" />
                    </View>
                );
            default:
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <ParallaxScrollView
                headerBackgroundColor={{ light: ACTIVE_COLOR, dark: ACTIVE_COLOR }}
                headerImage={
                    <View style={styles.headerContent}>
                        <View style={styles.topBar}>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.logoText}>Actions</Text>
                            <TouchableOpacity>
                                <Ionicons name="scan-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.balanceContainer}>
                            <Text style={styles.balanceLabel}>Your balance is</Text>
                            <View style={styles.balanceRow}>
                                <Text style={styles.balanceAmount}>
                                    {currency} {balance}
                                </Text>
                                <Text style={styles.dateBadge}>Available</Text>
                            </View>
                        </View>
                    </View>
                }>
            
                <ThemedView style={actionSheetStyles.mainSheet}>
                    <ScrollView contentContainerStyle={actionSheetStyles.scrollContent}>
                        
                        <ActionTabs activeTab={activeTab} setActiveTab={setActiveTab} />

                        {renderActiveContent()}

                    </ScrollView>
                    
                    {/* {activeTab !== "send" && (
                    <View style={actionSheetStyles.continueButtonWrapper}>
                        <TouchableOpacity style={actionSheetStyles.continueButton} 
                            onPress={() => {
                                console.log(`Continue with ${activeTab}`)
                                if(activeTab == "deposit"){
                                    router.push('/deposit');
                                }else{
                                    router.push("/receive");
                                }
                            }
                        }>
                            <Text style={actionSheetStyles.continueButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 10 }} />
                        </TouchableOpacity>
                    </View>
                    )} */}
                    

                </ThemedView>
            </ParallaxScrollView>
        </View>
    );
}


const ActionDetailRow = ({ label, value, icon, isPrimary = false }: any) => (
    <TouchableOpacity 
        onPress={()=>{
            router.push("/deposit_funds");
        }}
    >
        <View style={actionSheetStyles.detailsCard}>
            <View style={actionSheetStyles.detailRow}>
                <View>
                    <MaterialCommunityIcons name="hand-coin-outline" size={24} color={ACTIVE_COLOR} />
                </View>
                <Text style={actionSheetStyles.detailLabel}>Mobile Money</Text>
                <Text style={[actionSheetStyles.detailValue, isPrimary && actionSheetStyles.detailValuePrimary]}>
                    Active
                </Text>
            </View>
        </View>
    </TouchableOpacity>
);

const actionSheetStyles = StyleSheet.create({
    mainSheet: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginTop: -30, 
        marginLeft: -30, 
        marginRight: -30, 
        marginBottom: 130, 
        marginHorizontal: 15, 
        // paddingBottom: 20,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 20,
    },

    constactsContainer : {

    },
    activeUserOn : {
        width : 20,
        height : 20,
        padding : 20,
        borderStyle : "solid",
        borderColor : "#555",
        backgroundColor: '#000', 
    },
    
    // Action Tabs Styling (Deposit, Send, Receive)
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0', // Light background for the pill
        borderRadius: 20,
        padding: 4,
        marginBottom: 30,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 16,
    },
    activeTabButton: {
        backgroundColor: ACTIVE_COLOR, // Primary color for active state
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Content Styling
    contentSection: {
        marginBottom : 0,
    },
    contentSectionDeposit: {
        // marginBottom : 10,
    },
    contentHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        marginBottom: 20,
    },
    contentHeaderSend: {
        fontSize: 12,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        marginBottom: 10,
    },
    detailsCard : {
        // paddingBottom : 80,
        marginBottom : 10
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 30,
        borderRadius : 10,
        borderBottomWidth: 1,
        borderWidth : 1.3,
        borderColor : "#ccc"
    },
    detailLabel: {
        fontSize: 15,
        color: ACTIVE_COLOR,
        marginLeft: 15,
        fontWeight: '600',
    },
    detailValue: {
        marginLeft: 'auto',
        fontSize: 12,
        color: '#0070BB',
    },
    detailValuePrimary: {
        color: ACTIVE_COLOR,
        fontWeight: '800',
    },
    qrCodePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        backgroundColor: '#f5f5f5',
        borderRadius: 15,
        marginBottom: 30,
    },

    // Footer and Total
    spacer: {
        height: 40,
        borderBottomWidth: 2,
        borderBottomColor: '#f0f0f0',
        marginBottom: 20,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    totalLabel: {
        fontSize: 18,
        color: '#333',
        fontWeight: '600',
    },
    totalAmount: {
        fontSize: 24,
        fontWeight: '900', // Extra bold
        color: ACTIVE_COLOR,
    },

    // Floating Continue Button
    continueButtonWrapper: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    continueButton: {
        flexDirection: 'row',
        backgroundColor: ACTIVE_COLOR,
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});


const styles = StyleSheet.create({
    activeUserOn : {
        borderRadius: 50,
        paddingHorizontal: 3,
        paddingVertical: 3,
        backgroundColor : "#3CB371",
    },
    transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    transactionAvatar: {
        width: 44,
        height: 44,
        borderRadius: 50,
        marginRight: 15,
    },
    transactionInfo: {
        flex: 1,
    },
    networkCard : {
        padding : 10,
        flex: -1,
        justifyContent : "space-between",
    },
    transactionName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    noUserFoundText : {
        padding : 10,
        fontSize: 15,
        fontWeight: '600',
        color: '#555',
    },
    transactionDate: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    network:{
        fontSize: 12,
        color: '#258',
        marginTop: 2,
        fontWeight: '600',
    },
    verifyingText : {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    verifyingLoader : {
        flex: 1,
        flexDirection: 'row',
        justifyContent : "flex-end",     
    },
    transactionAmount: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#000',
    },
    transactionPayPerUser: {
        fontSize: 10,
        fontWeight: '500',
        color: '#3CB371',
    },







   contactWrapper: {
        width: '100%',
        display: "flex",
        flex: 1, 
        paddingVertical: 10,
        backgroundColor: '#000', 
    },
    contactRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 20, 
        borderBottomWidth: 1, 
        borderBottomColor: '#f8f8f8',
    },
    
    contactAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24, 
        backgroundColor: '#e0e0e0', 
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    
    avatarLetter: {
        color: ACTIVE_COLOR,
        fontSize: 20,
        fontWeight: 'bold',
    },
    
    contactInfo: {
        flex: 1, 
        justifyContent: 'center',
    },
    
    contactName: {
        fontSize: 16,
        fontWeight: '600',
        color: "#444",
    },
    
    // --- Contact Detail Text (Phone/Email) ---
    contactDetail: {
        fontSize: 13,
        color: INACTIVE_COLOR,
        marginTop: 2,
    },





    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff', 
        
        borderRadius: 15,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginBottom: 20,
        borderWidth: 1.5,
        borderStyle: "solid",
        borderColor: "#E1EBEE", 
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        marginLeft: 10,
        paddingVertical: 0,
        color: "#342",
    },
    searchStyle : {
        borderStyle : "solid",
        borderColor : "#434"
    },
    headerContent: {
        height: '100%',
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 60,
        backgroundColor: ACTIVE_COLOR,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    logoText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        position: 'absolute',
        left: '50%',
        transform: [{ translateX: -40 }],
    },
    balanceContainer: {
        gap: 5,
    },
    balanceLabel: {
        color: '#ccc',
        fontSize: 14,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 10,
    },
    balanceAmount: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '600',
    },
    dateBadge: {
        color: '#fff',
        fontSize: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
});