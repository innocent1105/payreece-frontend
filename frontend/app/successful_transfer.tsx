import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ACTIVE_COLOR = '#2A2A68'; 

type TransferSuccessScreenProps = {
    customTitle?: string;
    customMessage?: string;
    amount?: any;
    phone_number?: string;
};

export default function TransferSuccessScreen(props: TransferSuccessScreenProps) {
    const params = useLocalSearchParams();
    const amount = props.amount ?? params.amount;
    const username = params.username;
    const phone_number = props.phone_number ?? params.phone_number;
    const reference = params.reference;
    const title = props.customTitle ?? (phone_number != undefined ? 'Transfer Successful!' : 'Deposit Successful!');
    const message = props.customMessage ?? (phone_number != undefined ? `Has been sent to ${username ?? ''}` : 'Has been added to your balance');

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <View style={styles.circle}>
                        <Ionicons name="checkmark" size={60} color={ACTIVE_COLOR} />
                    </View>
                    <Ionicons name="sparkles" size={24} color="#B0C4DE" style={styles.star1} />
                    <Ionicons name="add" size={20} color="#B0C4DE" style={styles.star2} />
                </View>
                
                <Text style={styles.title}>{title}</Text>

                <View style={styles.amountBadge}>
                    <Text style={styles.amountText}>K{amount}</Text>
                </View>

                <Text style={styles.detailsText}>{message}</Text>

                {phone_number != undefined && (
                    <Text style={styles.phoneText}>({phone_number})</Text>
                )}

                {reference != undefined && (
                    <Text style={styles.referenceText}>Ref: {reference}</Text>
                )}


            </View>
            <TouchableOpacity 
                style={styles.doneButton} 
                onPress={() => router.replace('/')}
            >
                <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FF',
        padding: 25,
        paddingBottom : 50,
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        marginTop: -60,
    },
    iconContainer: {
        marginBottom: 40,
        position: 'relative',
    },
    circle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: ACTIVE_COLOR,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
    },
    star1: { position: 'absolute', top: -10, left: -20 },
    star2: { position: 'absolute', bottom: 10, right: -25 },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 25,
    },
    amountBadge: {
        backgroundColor: '#F0F2FF',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 15,
        marginBottom: 30,
    },
    amountText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
    },
    detailsText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
    phoneText: {
        fontSize: 14,
        color: '#BBB',
        marginTop: 5,
    },
    referenceText: {
        fontSize: 12,
        color: '#CCC',
        marginTop: 30,
        fontFamily: 'monospace',
    },
    doneButton: {
        backgroundColor: ACTIVE_COLOR,
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});