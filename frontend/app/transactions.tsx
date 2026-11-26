import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getToken } from '@/components/auth/auth';
import NoTransactions from '@/components/no-transactions';

import { BASE_URL } from '@/constants/api';

const TransactionsScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchTransactions = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await axios.post(`${BASE_URL}/transactions.php`, { token });
      
      if (res.data.success) {
        const transData = res.data.data.transactions;
        setTransactions(transData);
        await SecureStore.setItemAsync("p-transactions", JSON.stringify(transData));
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      const stored = await SecureStore.getItemAsync("p-transactions");
      if (stored) setTransactions(JSON.parse(stored));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchTransactions);
  }, []);


  const goToTransaction = (trans : any) => {  
    console.log(trans)


    // router.push({
    //   pathname: "/transaction", 
    //   params: trans 
    // });
  };

  const renderTransactionItem = ({ item: trans }: { item: any }) => {
    let IconComp;
    let iconStyle = styles.transactionIconTransfer;
    let iconColor = "#646775";

    if (trans.type === "deposit") {
      IconComp = <Feather name="arrow-down-left" size={22} color="#4A4AFF" />;
      iconStyle = styles.transactionIconDeposit;
    } else if (trans.type === "transfer") {
      if (trans.from_me) {
        IconComp = <Feather name="arrow-up-right" size={22} color="#646775" />;
        iconStyle = styles.transactionIconSend;
      } else {
        IconComp = <Feather name="arrow-down-left" size={22} color="#3EB489" />;
        iconStyle = styles.transactionIconReceive;
      }
    } else {
      IconComp = <Feather name="arrow-down-left" size={22} color="#3EB489" />;
      iconStyle = styles.transactionIconDeposit;
    }

    return (
      <TouchableOpacity onPress={() => goToTransaction(trans)} style={styles.transactionRow} activeOpacity={0.7}>
        <View style={iconStyle}>{IconComp}</View>
        
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionName} numberOfLines={1}>
            {trans.type === "deposit" ? "Deposit" : 
             trans.from_me ? `Sent to ${trans.other_sender_name}` : `From ${trans.other_sender_name}`}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDistanceToNow(new Date(trans.date), { addSuffix: true })}
          </Text>
        </View>

        <View style={styles.amountContainer}>
          {trans.type === "deposit" && (
            <Text style={styles.transactionSenderDetail}>0{trans.sender_id}</Text>
          )}
          <Text style={[styles.transactionAmount, { color: trans.from_me ? "#000" : "#3EB489" }]}>
            {trans.from_me ? "-" : "+"}K{trans.amount}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <View style={styles.bodyContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#2A2A68" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderTransactionItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={fetchTransactions} />
            }
            ListEmptyComponent={
              <NoTransactions onDepositPress={() => router.push("/deposit_funds")} />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A68',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop : 20
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  bodyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  // Icon Styles
  transactionIconDeposit: {
    padding: 10,
    marginRight: 15,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#C2C2FF",
    backgroundColor: "#E6E6FF"
  },
  transactionIconSend: {
    padding: 10,
    marginRight: 15,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#BEBECC",
    backgroundColor: "#F1F2F3"
  },
  transactionIconReceive: {
    padding: 10,
    marginRight: 15,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#DAF0DF",
    backgroundColor: "#FAFFFB"
  },
  transactionIconTransfer: {
    padding: 10,
    marginRight: 15,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#839AF7",
    backgroundColor: "#F5F7FF"
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  transactionDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  transactionSenderDetail: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
});

export default TransactionsScreen;