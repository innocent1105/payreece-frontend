import { FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#2b4dab'; 
const INACTIVE_COLOR = '#999';

const PaymentScreen = () => {
  const [selectedMethod, setSelectedMethod] = useState('mobile-money');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.header}>Payments</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.mainWrapper}>
          <Text style={styles.title}>Payment methods</Text>
          <Text style={styles.subtitle}>Choose a payment method to continue</Text>

          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.methodOption, selectedMethod === 'mobile-money' && styles.selectedOption]}
            onPress={() => setSelectedMethod('mobile-money')}
          >
            <View style={styles.methodRow}>
              <View style={styles.iconCircle}>
                <MaterialIcons 
                    name="phonelink-ring" 
                    size={26} 
                    color={selectedMethod === 'mobile-money' ? ACTIVE_COLOR : "#64748B"} 
                />
              </View>
              <View>
                <Text style={styles.methodText}>Mobile Money</Text>
                <Text style={styles.methodSubtext}>MTN, Airtel, or Zamtel</Text>
              </View>
            </View>
            <View style={[styles.radio, selectedMethod === 'mobile-money' && styles.radioSelected]}>
                {selectedMethod === 'mobile-money' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>



          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.methodOption, selectedMethod === 'master-card' && styles.selectedOption]}
            onPress={() => setSelectedMethod('master-card')}
          >
            <View style={styles.methodRow}>
              <View style={styles.iconCircle}>
                <FontAwesome name="cc-mastercard" size={22} 
                    color={selectedMethod === 'master-card' ? ACTIVE_COLOR : "#64748B"}
                />
              </View>
              <View>
                <Text style={styles.methodText}>Master Card</Text>
                <Text style={styles.methodSubtext}>Pay via digital wallet</Text>
              </View>
            </View>
            <View style={[styles.radio, selectedMethod === 'master-card' && styles.radioSelected]}>
                {selectedMethod === 'master-card' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

        
          <TouchableOpacity 
            activeOpacity={0.7}
            style={[styles.methodOption, selectedMethod === 'paypal' && styles.selectedOption]}
            onPress={() => setSelectedMethod('paypal')}
          >
            <View style={styles.methodRow}>
              <View style={styles.iconCircle}>
                <FontAwesome 
                    name="paypal" 
                    size={22} 
                    color={selectedMethod === 'paypal' ? ACTIVE_COLOR : "#64748B"} 
                />
              </View>
              <View>
                <Text style={styles.methodText}>PayPal</Text>
                <Text style={styles.methodSubtext}>Pay via digital wallet</Text>
              </View>
            </View>
            <View style={[styles.radio, selectedMethod === 'paypal' && styles.radioSelected]}>
                {selectedMethod === 'paypal' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>


        





        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.proceedButton}>
          <Text style={styles.proceedButtonText}>Proceed</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  mainWrapper: {
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 32,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9', 
    marginBottom: 16,
  },
  selectedOption: {
    borderColor: ACTIVE_COLOR,
    backgroundColor: '#F8FAFF',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 14,
    color: '#1E293B',
  },
  methodSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginLeft: 14,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: ACTIVE_COLOR,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACTIVE_COLOR,
  },
  footer: {
    padding: 24,
    paddingBottom: 70,
  },
  proceedButton: {
    backgroundColor: '#0066FF',
    height: 58,
    borderRadius: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
});

export default PaymentScreen;