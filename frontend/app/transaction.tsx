import { Feather, Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SingleTransactionScreen() {
  const item = useLocalSearchParams();

  const isOutbound = item.from_me === 'true' || item.from_me === true;
  const fee = item.fee || 0;
  const ref = item.reference || 'txn-x';
  const total = parseFloat(item.amount) + parseFloat(fee);

  const statusColor = "#3EB489"; 

  const onShare = async () => {
    try {
      await Share.share({
        message: `
            Transaction Receipt: K${item.amount} ${isOutbound ? 
            'sent to' : 'received from'} ${item.other_sender_name}. Ref: TXN-${ref}
            
Date: ${item.date ? format(new Date(item.date), 'dd MMM yyyy, HH:mm') : 'Recent'}
Type: ${item.type === 'deposit' ? 'Wallet Deposit' : 'Fund Transfer'}
Amount: K${item.amount}
Fee: K${fee}
Total: K${total}

Thank you for using Payreece!
`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Receipt</Text>
        <TouchableOpacity onPress={onShare}>
          <Feather name="share-2" size={22} color="#2A2A68" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.statusContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#FAFFFB', borderColor: '#DAF0DF' }]}>
            <Ionicons name="checkmark-circle" size={50} color={statusColor} />
          </View>
          <Text style={styles.statusText}>Payment Successful</Text>
          <Text style={styles.mainAmount}>
            {isOutbound ? '-' : '+'} K{item.amount}
          </Text>
        </View>
        <View style={styles.detailsCard}>
          <DetailRow label="Transaction Type" value={item.type === 'deposit' ? 'Wallet Deposit' : 'Bank Transfer'} />
          <DetailRow label="Date & Time" value={item.date ? format(new Date(item.date), 'dd MMM yyyy, HH:mm') : 'Recent'} />
          <DetailRow label={isOutbound ? "Recipient" : "Sender"} value={item.other_sender_name || "Unknwon User"} />
          <DetailRow label="Reference" value={item.reference} isCopyable />
          
          <View style={styles.divider} />
        
          { isOutbound && (
            <View>
                <DetailRow label="Amount" value={`K${item.amount}`} />
                <DetailRow label="Fee" value={`K${fee}`} />
            </View>
          )}
          

          <DetailRow 
            label="Total" 
            value={`K${item.amount}`} 
            valueStyle={{ color: '#2A2A68', fontWeight: 'bold', fontSize: 18 }} 
          />
        </View>

        <View style={styles.footer}>
      
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push("/")}
          >
            <Text style={styles.primaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const DetailRow = ({ label, value, isCopyable = false, valueStyle = {} }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
      {isCopyable && <Feather name="copy" size={14} color="#94A3B8" />}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop : 20
  },
  backButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusText: {
    fontSize: 14,
    color: '#3EB489',
    fontWeight: '600',
    marginBottom: 5,
  },
  mainAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2A2A68',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
    borderStyle: 'dashed',
  },
  footer: {
    width: '100%',
    marginTop: 20,
    marginBottom: 30,
    // gap: 15,
  },
  primaryButton: {
    backgroundColor: '#2A2A68',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportButton: {
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#64748B',
    fontSize: 14,
    textDecorationLine: 'underline',
  }
});