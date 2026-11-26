import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NoTransactions = ({ onDepositPress }: { onDepositPress?: () => void }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <SimpleLineIcons name="wallet" size={48} color="#011F5B" opacity={0.3} />
      </View>

      <Text style={styles.title}>No Transactions Yet</Text>
      
      <Text style={styles.description}>
        Your transaction history is empty. Deposit funds to start using your account.
      </Text>

      <TouchableOpacity 
        style={styles.depositButton} 
        onPress={onDepositPress}
        activeOpacity={0.8}
      >
        <SimpleLineIcons name="plus" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.buttonText}>Deposit Now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
   container: {
    flex: 1, 
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center', 
    padding: 40,
    paddingTop : 0,
    // borderWidth : 2,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#011F5B',
    marginBottom: 10,
    fontFamily: 'System', // Replace with your heading font
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  depositButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35', // Matching your EduConnect theme
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4, // Android shadow
    shadowColor: '#FF6B35', // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NoTransactions;