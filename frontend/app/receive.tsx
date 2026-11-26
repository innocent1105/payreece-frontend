import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, Share } from 'react-native';

const ACTIVE_COLOR = '#2A2A68'; 
const INACTIVE_COLOR = '#999';

// Reusable Detail Row
const ReceiveDetailRow = ({ label, value, icon }: any) => (
    <View style={receiveStyles.detailRow}>
        <Ionicons name={icon} size={20} color={INACTIVE_COLOR} style={{ width: 20 }} />
        <Text style={receiveStyles.detailLabel}>{label}</Text>
        <Text style={receiveStyles.detailValue}>{value}</Text>
    </View>
);

export default function ReceiveScreen() {

    const accountId = "PZ-2025-5678";
    const qrCodeLink = `payzz://receive/${accountId}`;

    const onShare = async () => {
        try {
            await Share.share({
                message: `Pay me instantly via Payzz! My Account ID is: ${accountId}`,
                url: qrCodeLink,
            });
        } catch (error) {
            console.error('Share failed:', error);
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
                            <Text style={styles.logoText}>Receive</Text>
                            <View style={{ width: 24 }} /> {/* Spacer */}
                        </View>
                        <View style={styles.balanceContainer}>
                            <Text style={styles.balanceLabel}>Account Name</Text>
                            <Text style={styles.balanceAmount}>John Doe</Text>
                        </View>
                    </View>
                }>
                
                <ThemedView style={receiveStyles.mainSheet}>
                    <ScrollView contentContainerStyle={receiveStyles.scrollContent}>
                        
                        <Text style={receiveStyles.sectionTitle}>Your Payment QR Code</Text>
                        
                        {/* QR Code Placeholder */}
                        <View style={receiveStyles.qrCodeContainer}>
                            {/* In a real app, you would use a library like 'react-native-qrcode-svg' here */}
                             <Ionicons name="qr-code-outline" size={180} color={ACTIVE_COLOR} />
                             <Text style={receiveStyles.qrHint}>Scan this code to send funds instantly.</Text>
                        </View>

                        <View style={receiveStyles.separator} />
                        
                        <Text style={receiveStyles.sectionTitle}>Account Details</Text>
                        
                        <ReceiveDetailRow label="Account ID" value={accountId} icon="key-outline" />
                        <ReceiveDetailRow label="Account Type" value="Personal Wallet" icon="card-outline" />
                        <ReceiveDetailRow label="Verified" value="Yes" icon="checkmark-circle-outline" />
                        
                    </ScrollView>
                    
                    {/* Floating Share Button */}
                    <View style={receiveStyles.continueButtonWrapper}>
                        <TouchableOpacity style={receiveStyles.shareButton} onPress={onShare}>
                            <Ionicons name="share-social-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
                            <Text style={receiveStyles.continueButtonText}>Share Account Details</Text>
                        </TouchableOpacity>
                    </View>
                </ThemedView>
            </ParallaxScrollView>
        </View>
    );
}

const receiveStyles = StyleSheet.create({
    mainSheet: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30, 
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
    
    // QR Code
    qrCodeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9f9f9',
        borderRadius: 20,
        padding: 30,
        marginVertical: 10,
    },
    qrHint: {
        color: INACTIVE_COLOR,
        marginTop: 15,
        fontSize: 14,
        fontWeight: '500',
    },
    
    separator: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 20,
    },
    
    // Detail Rows
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    detailLabel: {
        fontSize: 15,
        color: '#666',
        marginLeft: 15,
    },
    detailValue: {
        marginLeft: 'auto',
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },

    // Floating Share Button
    continueButtonWrapper: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
    },
    shareButton: {
        flexDirection: 'row',
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