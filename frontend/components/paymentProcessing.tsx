import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const ACTIVE_COLOR = '#2A2A68'; 
const WARNING_COLOR = '#333'; 



export default function TransactionProcessingCard({amount, receiver, mobileNumber}){
    const processingData = {
        amount: amount,
        recipientName: receiver,
        recipientPhone:  mobileNumber,
    };
    const CURRENCY = 'K'; 
    return (
        <View style={styles.cardWrapper}>
            <View style={styles.header}>
                <ActivityIndicator size="small" color={WARNING_COLOR} style={styles.spinner} />
                
                <Text style={styles.headerText}>Processing Transaction...</Text>
            </View>

            <View style={styles.separator} />
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>{CURRENCY} {processingData.amount}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recipient</Text>
                <Text style={styles.summaryValue}>{processingData.recipientName}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phone</Text>
                <Text style={styles.summaryValue}>{processingData.recipientPhone}</Text>
            </View>
            
            <View style={styles.noteContainer}>
                 <Text style={styles.noteText}>
                    Please wait. This usually takes a few seconds. Do not close the app.
                 </Text>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        width: '100%',
        alignSelf: 'center',
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        marginTop: 30,
        borderWidth: 1,
        borderColor: WARNING_COLOR, 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        gap : 4,
        paddingBottom: 10,
    },
    spinner: {
        marginRight: 8,
    },
    icon: {
        marginRight: 8,
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WARNING_COLOR,
    },
    separator: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666',
    },
    summaryValue: {
        fontSize: 14,
        color: ACTIVE_COLOR,
        fontWeight: '600',
    },
    noteContainer: {
        marginTop: 20,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
    },
    noteText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
    }
});