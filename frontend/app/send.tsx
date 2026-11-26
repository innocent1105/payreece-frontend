import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import TransactionProcessingCard from '@/components/paymentProcessing';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const ACTIVE_COLOR = '#2A2A68'; 
const INACTIVE_COLOR = '#999';

const MOCK_CONTACTS = [
    { id: '1', name: 'Jenny Wilson', amount: '$160' },
    { id: '2', name: 'Albert Flores', amount: '$250' },
    { id: '3', name: 'Cameron Williamson', amount: '$10' },
    { id: '4', name: 'Kathryn Murphy', amount: '$50' },
];

const ContactRow = ({ item, isSelected, onPress }: any) => (
    <TouchableOpacity 
        style={[sendStyles.contactRow, isSelected && sendStyles.selectedContactRow]} 
        onPress={() => onPress(item)}
    >
        <Ionicons name="person-circle-outline" size={30} color={isSelected ? '#fff' : ACTIVE_COLOR} />
        <Text style={[sendStyles.contactName, { color: isSelected ? '#fff' : '#000' }]}>{item.name}</Text>
        <Text style={[sendStyles.lastAmount, { color: isSelected ? '#fff' : INACTIVE_COLOR }]}>Sent {item.amount}</Text>
    </TouchableOpacity>
);

export default function SendScreen() {
    const { id, username, phone_number, amount } = useLocalSearchParams();
    const [user_token, setUserToken] = useState(null);

    useEffect(() =>{
        const loadToken = async ()=>{
            const token = await getToken();
            setUserToken(token);
        }
        loadToken();
    }, [])


    const [selectedContact, setSelectedContact] = React.useState(MOCK_CONTACTS[0]);
    const fee = (parseFloat(amount) * 0.015).toFixed(2);
    const total = (parseFloat(amount) + parseFloat(fee)).toFixed(2);
    const [processing, setProcessing] = useState(false);
    const [password, setPassword] = useState(null);

    const [transactionError, setTransactionError] = useState("");
    const [transactionSuccess, setTransactionSuccess] = useState(false);


    const getNetworkProvider = (phone) => {
        if (!phone) return "Unknown";
        
        const cleanPhone = phone.replace(/\s/g, '').replace('+26', '');
        const prefix = cleanPhone.substring(0, 3);

        if (['096', '076'].includes(prefix)) return "MTN";
        if (['097', '077'].includes(prefix)) return "Airtel";
        if (['095', '075'].includes(prefix)) return "Zamtel";
        
        return "Other";
    };

    const networks = ["MTN", "AIRTEL", "ZAMTEL"];
    const detectedNetwork = getNetworkProvider(phone_number);
    const [selectedNetwork, setSelectedNetwork] = useState(detectedNetwork);
    const handleNetworkPress = (networkName: string) => {
        setSelectedNetwork(networkName);
    };
    const NETWORK_COLORS: { [key: string]: string } = {
        MTN: '#FEBE10',    
        AIRTEL: '#EE204D',
        ZAMTEL: '#00A651',  
    };

    const sendFunds = async ()=>{
        const transfer = {
            sender_id : user_token, 
            receiver_id : id,
            username : username,
            phone_number : phone_number,
            amount : amount,
            password : password,
            selectedNetwork : selectedNetwork
        }

        setProcessing(true);
        
        try{
            const url = `${BASE_URL}/send_to_user.php`; 
            const res = await axios.post(url, transfer,{ 
                timeout: 10000
            });
            console.log(res.data);
            if(res.data.success){
                const reference = res.data.reference;
                setTransactionSuccess(true);
                router.push({
                    pathname: "/successful_transfer",
                    params: { 
                        amount: amount, 
                        username: username, 
                        phone_number: phone_number,
                        reference: res.data.reference 
                    }
                });
            }else{
                const message = res.data.message;
                setTransactionError(message);
            }
        }catch(e){
            console.log(e);
            setTransactionError("Failed, please try again later");
        }finally{
            setProcessing(false);
        }
    }


  
    



    return (
        <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        style={{ flex: 1 }}>
            <ParallaxScrollView
                headerBackgroundColor={{ light: ACTIVE_COLOR, dark: ACTIVE_COLOR }}
                headerImage={
                    <View style={styles.headerContent}>
                        <View style={styles.topBar}>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.logoText}>Send Money</Text>
                            <TouchableOpacity>
                                <Ionicons name="search" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                }>
                
                <ThemedView style={sendStyles.mainSheet}>
                    <ScrollView contentContainerStyle={sendStyles.scrollContent}>
                        
                        {processing ? (
                            <Text style={sendStyles.sectionTitle}>
                                Please wait...
                            </Text>
                        ):(
                            <Text style={sendStyles.sectionTitle}>
                                Comfirm payment
                            </Text>
                        )}
                        
                        

                        <View style={sendStyles.separator} />

                        {processing ? (
                            <View>
                                <TransactionProcessingCard 
                                    amount={amount}
                                    receiver={username}
                                    mobileNumber={phone_number}
                                />
                            </View>
                        ) : (
                        <View>
                            <Text style={sendStyles.sectionTitle}>Transfer Details</Text>
                            <View style={sendStyles.sendDetWrapper}>
                                <Text style={sendStyles.transferDetText}>
                                    Reciepient name
                                </Text>
                                <Text style={sendStyles.transferDetTextUser}>
                                    {username}
                                </Text>
                            </View>
                                <View style={sendStyles.sendDetWrapper}>
                                    <Text style={sendStyles.transferDetText}>
                                        Mobile number 
                                    </Text>
                                    <Text style={sendStyles.transferDetTextUser}>
                                        {phone_number}
                                    </Text>
                                </View>
                        

                            <View style={sendStyles.amountInputContainer}>
                                <Text style={sendStyles.currencySymbol}>K</Text>
                                <Text style={sendStyles.amountInput}>
                                    {amount}
                                </Text>
                            </View>


                            {/* <View style={sendStyles.summaryRow}>
                                {networks.map((mobileNetwork, index) => {
                                    const isActive = mobileNetwork === selectedNetwork; 
                                    const brandColor = NETWORK_COLORS[mobileNetwork];

                                    return (
                                        <View key={index} style={sendStyles.networkCard}>
                                            <TouchableOpacity 
                                                onPress={() => handleNetworkPress(mobileNetwork)}
                                                style={[
                                                    sendStyles.networkBase, 
                                                    isActive && { 
                                                        backgroundColor: brandColor, 
                                                        borderColor: brandColor,  
                                                        borderWidth: 3, 
                                                    }
                                                ]}
                                            >
                                                <Text 
                                                    style={[
                                                        sendStyles.networkLabel, 
                                                        isActive && { color: '#fff', fontWeight: 'bold' } 
                                                    ]}
                                                >
                                                    {mobileNetwork}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View> */}

                            <View style={sendStyles.summaryBox}>
                                <View style={sendStyles.summaryRow}>
                                    <Text style={sendStyles.summaryLabel}>Fee (1.5%)</Text>
                                    <Text style={sendStyles.summaryValue}>K{fee}</Text>
                                </View>
                                <View style={sendStyles.summaryRow}>
                                    <Text style={sendStyles.summaryLabel}>Total Payment</Text>
                                    <Text style={sendStyles.totalAmount}>K{total}</Text>
                                </View>
                            </View>
                           
                            <View style={sendStyles.separator} />
                            
                            {transactionError.length > 0 && (
                                <View style={sendStyles.t_error}>
                                    <Text style={sendStyles.t_error_message}>
                                        {transactionError}
                                    </Text>
                                </View>
                            )}
                            


                            <Text style={sendStyles.passwordLabel}>
                                Enter password
                            </Text>
                            <View style={sendStyles.passwordInput}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your PIN or Password"
                                    placeholderTextColor="#999"
                                     secureTextEntry={true}
                                    keyboardType="numeric"
                                    value={password}
                                    onChangeText={setPassword}
                                    maxLength={6} 
                                />
                            </View>

                        </View>
                        )}
                       
                        
                    </ScrollView>
                    
                    {!processing && (
                        <View style={sendStyles.continueButtonWrapper}>
                            <TouchableOpacity style={sendStyles.continueButton} 
                                onPress={() => {
                                        sendFunds();
                                        // setProcessing(true)
                                    }
                                }>
                                <Text style={sendStyles.continueButtonText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    

                </ThemedView>
            </ParallaxScrollView>
        </KeyboardAvoidingView>
    );
}

const sendStyles = StyleSheet.create({
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
        marginBottom: 320, 
        marginHorizontal: 15, 
        paddingBottom: 100,
        minHeight: 600,
    },
    t_error : {
        borderWidth : 1.3,
        padding : 14,
        borderRadius : 5,
        borderColor : "#f42555db",
        backgroundColor : "#ffc8d530",
    },
    t_error_message : {
        color : "#f42555db"
    },
    successRepostCard : {
        borderWidth : 1,
        padding : 20,
        borderRadius : 10,
        borderColor : "#ccc"
    },
    passwordInput : {
        borderWidth : 1.4,
        padding : 5,
        paddingHorizontal : 14,
        borderRadius : 10,
        borderColor : "#ccc"
    },
    passwordLabel : {
        fontSize : 14,
        fontWeight : 500,
        marginTop : 10,
        marginBottom : 10,
    },















    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 30,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: ACTIVE_COLOR,
        marginBottom: 15,
        marginTop: 0,
    },
    sendDetWrapper :{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent : "space-between",
        display : "flex",
        flex : 1,
    },
    
    // Contact List
    contactList: {
        paddingBottom: 10,
    },
    contactRow: {
        flexDirection: 'column',
        alignItems: 'center',
        marginRight: 15,
        padding: 15,
        borderRadius: 15,
        backgroundColor: '#f9f9f9',
    },
    selectedContactRow: {
        backgroundColor: ACTIVE_COLOR,
    },
    contactName: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 5,
    },
    lastAmount: {
        fontSize: 12,
        color: INACTIVE_COLOR,
        marginTop: 2,
    },

    separator: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 10,
    },
    
    // Amount Input
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 10,
        paddingVertical: 10,
    },
    currencySymbol: {
        fontSize: 40,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        marginRight: 8,
    },
    transferDetText : {
        fontSize : 16,
        color : "#333"
    },
    transferDetTextUser : {
        fontSize : 16,
        color : "#333",
        fontWeight : "500"
    },
    amountInput: {
        fontSize: 40,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        padding: 0,
        textAlign: 'left',
    },
    
    summaryBox: {
        backgroundColor: '#f5f5ff',
        borderRadius: 15,
        padding: 20,
        marginTop: 10,
    },
    selectNetworkWrapper : {
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 15,
        color: '#666',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '600',
    },
    totalAmount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
    },

    networkCard :{
        width : "32%"
    },
 
    // Base style used for all cards
    networkBase: {
        width: "100%",
        borderWidth : 2,
        borderColor : "#B0C4DE", // Light gray/blue border for inactive state
        backgroundColor : "#fff",
        padding : 20,
        borderRadius : 10,
        alignItems: 'center',
        // Note: activeNetworkCard style object is removed and applied inline in JSX
    },
    
    networkLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#444',
    },
    activeNetworkLabel: {
        color: '#fff',
        fontWeight: 'bold',
    },


    networkMTN : {
        width: "100%",
        borderWidth : 2,
        borderColor : "#B0C4DE",
        backgroundColor : "#fff",
        padding : 20,
        borderRadius : 10,
    },
    networkAIRTEL : {
        width: "100%",
        borderWidth : 2,
        borderColor : "#B0C4DE",
        backgroundColor : "#fff",
        padding : 20,
        borderRadius : 10,
    },
    networkZAMTEL : {
        width: "100%",
        borderWidth : 2,
        borderColor : "#B0C4DE",
        backgroundColor : "#fff",
        padding : 20,
        borderRadius : 10,
    },

    // Floating Continue Button
    continueButtonWrapper: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    continueButton: {
        backgroundColor: ACTIVE_COLOR,
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

// Reused Header Styles (same as DepositScreen)
const styles = StyleSheet.create({
    headerContent: {
        height: '100%',
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 60,
        backgroundColor: ACTIVE_COLOR,
    },
    input: {
        flex: 1,
        fontSize: 18,
        color: '#333',
        paddingVertical: 10,
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
    },
});