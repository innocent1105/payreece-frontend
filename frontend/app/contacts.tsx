import { getToken } from '@/components/auth/auth';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY_BLUE = '#4C6FFF'; 
const BORDER_COLOR = '#E5E7EB';

export default function AddMoneyScreen() {
    const [user_token, setUserToken] = useState(null);
    const [CONTACTS, SETCONTACTS] = useState([]);

    useEffect(()=>{
        const loadToken = async ()=>{
            const token = await getToken();
            if(token){
                setUserToken(token);
            }
        }   
        loadToken();
    },)




    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contacts</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <ScrollView >
                </ScrollView>  
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ... your existing styles ...
    container: { paddingTop: 40, flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
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