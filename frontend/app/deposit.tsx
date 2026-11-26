import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const ACTIVE_COLOR = '#2A2A68'; 
const INACTIVE_COLOR = '#999';

export const options = {
  title: 'Deposit',
  headerStyle: { backgroundColor: ACTIVE_COLOR },
  headerTintColor: '#fff',
};

export default function DepositScreen() {
    const [amount, setAmount] = React.useState('500'); 
    const [source, setSource] = React.useState('Bank Account (**** 1234)');

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
                            <Text style={styles.logoText}>Deposit</Text>
                            <View style={{ width: 24 }} /> {/* Spacer */}
                        </View>
                        <View style={styles.balanceContainer}>
                            <Text style={styles.balanceLabel}>Current Balance</Text>
                            <Text style={styles.balanceAmount}>$45,934.00</Text>
                        </View>
                    </View>
                }>
                
                <ThemedView style={depositStyles.mainSheet}>
                    <ScrollView contentContainerStyle={depositStyles.scrollContent}>
                        
                        <Text style={depositStyles.sectionTitle}>Select Source</Text>
                        
                        {/* Source Selector (e.g., Bank Account) */}
                        <TouchableOpacity style={depositStyles.selectorRow} onPress={() => console.log('Open source picker')}>
                            <Ionicons name="business-outline" size={24} color={ACTIVE_COLOR} />
                            <Text style={depositStyles.selectorLabel}>{source}</Text>
                            <Ionicons name="chevron-forward" size={20} color={INACTIVE_COLOR} />
                        </TouchableOpacity>

                        <View style={depositStyles.separator} />
                        
                        <Text style={depositStyles.sectionTitle}>Enter Amount</Text>

                        {/* Amount Input */}
                        <View style={depositStyles.amountInputContainer}>
                            <Text style={depositStyles.currencySymbol}>$</Text>
                            <TextInput
                                style={depositStyles.amountInput}
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                                placeholder="0.00"
                                autoFocus
                            />
                        </View>
                        
                        <Text style={depositStyles.feeText}>Est. Fee: $0.00 | Instant Deposit</Text>
                        
                    </ScrollView>
                    
                    {/* Floating Continue Button */}
                    <View style={depositStyles.continueButtonWrapper}>
                        <TouchableOpacity style={depositStyles.continueButton} onPress={() => console.log(`Confirm deposit of $${amount}`)}>
                            <Text style={depositStyles.continueButtonText}>Confirm Deposit</Text>
                        </TouchableOpacity>
                    </View>
                </ThemedView>
            </ParallaxScrollView>
        </View>
    );
}

const depositStyles = StyleSheet.create({
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
        marginBottom: 60, 
        marginHorizontal: 15, 
        paddingBottom: 100,
        minHeight: 600,
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
        marginTop: 20,
    },
    
    // Source Selector
    selectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 15,
        paddingHorizontal: 15,
    },
    selectorLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    separator: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 20,
    },
    
    // Amount Input
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        paddingVertical: 20,
    },
    currencySymbol: {
        fontSize: 48,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        marginRight: 10,
    },
    amountInput: {
        fontSize: 48,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        padding: 0,
        minWidth: '50%',
        textAlign: 'left',
    },
    feeText: {
        textAlign: 'center',
        color: INACTIVE_COLOR,
        fontSize: 14,
        marginBottom: 30,
    },

    // Floating Continue Button
    continueButtonWrapper: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    continueButton: {
        backgroundColor: '#2ecc71', // Green for Deposit/Income
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

// Reused Header Styles
const styles = StyleSheet.create({
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
    },
    balanceContainer: {
        gap: 5,
    },
    balanceLabel: {
        color: '#ccc',
        fontSize: 14,
    },
    balanceAmount: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '600',
    },
});