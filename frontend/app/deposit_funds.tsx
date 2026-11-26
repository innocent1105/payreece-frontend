import { BASE_URL } from '@/constants/api';
import { getToken } from '@/components/auth/auth';
import TransactionProcessingCard from '@/components/paymentProcessing';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TransferSuccessScreen from './successful_transfer';

const PRIMARY_BLUE = '#4C6FFF'; 
const BORDER_COLOR = '#E5E7EB';

export default function AddMoneyScreen() {
    const [user_token, setUserToken] = useState<string | null>(null);

    useEffect(() => {
        getToken().then((token) => {
            if (token) setUserToken(token);
        });
    }, []);

    const [amount, setAmount] : any = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [status, setStatus] = useState<'input' | 'pending' | 'success'>('input');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isReady = Number(amount) > 0 && mobileNumber.length >= 10;

    useEffect(() => () => {
        if (pollRef.current) clearInterval(pollRef.current);
    }, []);

    const parseJson = async (response: Response) => {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text.slice(0, 200) || 'Invalid server response');
        }
    };

    const handleAddMoney = async () => {
        setStatus('pending'); 
            
        try {
            const response = await fetch(`${BASE_URL}/deposit_funds.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    amount: Number(amount),
                    phone: mobileNumber,
                    p_id: user_token
                })
            });

            const result = await parseJson(response);
            console.log(result);
            if (result.success && result.reference) {
                checkStatusPeriodically(result.reference);
            } else {
                alert(result.message || 'Could not initiate deposit. Please try again.');
                setStatus('input');
            }
        } catch (error) {
            setStatus('input');
            alert("Network error");
            console.log(error);
        }
    };





const checkStatusPeriodically = (ref: string) => {
    let attempts = 0;
    const maxAttempts = 40;

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch(
                `${BASE_URL}/check_deposit_status.php?ref=${encodeURIComponent(ref)}`,
                { headers: { 'Accept': 'application/json' } },
            );
            const data = await parseJson(res);

            if (data.status === 'successful' || data.success === true && data.status === 'success') {
                if (pollRef.current) clearInterval(pollRef.current);
                setStatus('success');
            } else if (data.status === 'failed' || attempts >= maxAttempts) {
                if (pollRef.current) clearInterval(pollRef.current);
                setStatus('input');
                alert('Transaction failed or timed out. Please try again.');
            }
        } catch (e) {
            console.error('Polling error', e);
        }
    }, 3000);
};





    if (status === 'success') {
        return (
            <TransferSuccessScreen
                customTitle="Top Up Success"
                customMessage="Has been added to your balance"
                amount={amount}
                phone_number={mobileNumber}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Money</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {status === 'input' ? (
                    <>
                        <Text style={styles.sectionTitle}>Mobile Money</Text>
                        <Text style={styles.sectionSubtitle}>
                            Add money to your account via Mobile Money.
                        </Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Amount"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Mobile Number"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="phone-pad"
                                value={mobileNumber}
                                onChangeText={setMobileNumber}
                            />
                        </View>

                        <View style={styles.securityBadge}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={PRIMARY_BLUE} />
                            <Text style={styles.securityText}>Your money is held in Licensed Banks</Text>
                        </View>

                        <TouchableOpacity 
                            disabled={!isReady}
                            style={[styles.addButton, { backgroundColor: isReady ? PRIMARY_BLUE : '#D1D5DB' }]}
                            onPress={handleAddMoney}
                        >
                            <Text style={styles.addButtonText}>Add Money</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.pendingContainer}>
                        <TransactionProcessingCard 
                            amount={amount}
                            receiver="Your Wallet"
                            mobileNumber={mobileNumber}
                        />
                        <Text style={styles.waitText}>Waiting for USSD confirmation...</Text>
                        <ActivityIndicator size="large" color={PRIMARY_BLUE} style={{ marginTop: 20 }} />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ... your existing styles ...
    container: { paddingTop: 40, flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    headerBackButton: { width: 24, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 24, flex: 1 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    sectionSubtitle: { fontSize: 15, color: '#6B7280', marginBottom: 32 },
    inputContainer: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: BORDER_COLOR, borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, height: 60, justifyContent: 'center' },
    input: { fontSize: 16, color: '#111827' },
    securityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FF', padding: 12, borderRadius: 10, marginVertical: 20, borderWidth: 1, borderColor: '#E0E7FF' },
    securityText: { fontSize: 13, color: '#374151', marginLeft: 10, fontWeight: '500' },
    addButton: { height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    pendingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    waitText: { marginTop: 20, color: '#6B7280', fontSize: 16, textAlign: 'center' }
});