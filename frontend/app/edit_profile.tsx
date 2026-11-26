import { getToken } from '@/components/auth/auth';
import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { BASE_URL } from '@/constants/api';

export default function EditProfileScreen() {

    // Form States
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [formData, setFormData] = useState({
        fullname: '',
        username: '',
        email: '',
        phone_number: '',
        student_id: '',
        gender: 'other',
        avatar: '',
    });

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const stored = await SecureStore.getItemAsync('dashboard_data');
                if (!active || !stored) return;
                const { data } = JSON.parse(stored);
                setFormData({
                    fullname: data.fullname || data.full_name || '',
                    username: data.username || '',
                    email: data.email || '',
                    phone_number: data.phone_number || '',
                    student_id: data.student_id || '',
                    gender: data.gender || 'other',
                    avatar: data.avatar || '',
                });
            } catch (e) {
                console.error('Failed to load user data', e);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const askPermission = async () => {
        if (Platform.OS !== 'web') {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'We need gallery access to change your profile picture.',
                    [{ text: 'OK' }]
                );
                return false;
            }
            return true;
        }
        return true;
    };

    const pickImage = async () => {
        const hasPermission = await askPermission();
        if (!hasPermission) return;

        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
                base64: true,
            });

            if (!result.canceled) {
                setFormData({
                    ...formData,
                    avatar: `data:image/jpeg;base64,${result.assets[0].base64}`
                });
            }
        } catch (error) {
            Alert.alert("Error", "Could not pick image");
        }
    };

    const handleUpdate = async () => {
        if (!formData.fullname || !formData.username || !formData.email) {
            Alert.alert("Missing Info", "Please fill in all required fields.");
            return;
        }

        setUpdating(true);
        const token = await getToken();

        try {
            const res = await axios.post(`${BASE_URL}/update_profile.php`, {
                token,
                ...formData
            }, { timeout: 15000 });

            console.log(res.data);
            if (res.data.success) {
                 if (res.data.updated_user) {
                    const stored = await SecureStore.getItemAsync('dashboard_data');
                    const cached = stored ? JSON.parse(stored) : {};
                    const data = { ...(cached.data || {}), ...res.data.updated_user };
                    await SecureStore.setItemAsync('dashboard_data', JSON.stringify({ ...cached, data }));
                 }
                Alert.alert("Success", "Your profile has been updated.");
                router.back();
            } else {
                Alert.alert("Failed", res.data.message || "Update unsuccessful.");
            }
        } catch (e) {
            Alert.alert("Error", "Network error. Image might be too large or server is down.");
        } finally {
            setUpdating(false);
        }
    };

    const getAvatarSource = () => {
        if (formData.avatar.startsWith('data:image')) return { uri: formData.avatar };
        return { uri: `${BASE_URL}/view_pp.php?file=${formData.avatar}` };
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2A2A68" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={handleUpdate} disabled={updating} style={styles.navBtn}>
                    {updating ? (
                        <ActivityIndicator size="small" color="#2A2A68" />
                    ) : (
                        <Text style={styles.saveText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarWrapper}>
                        <Image
                            source={getAvatarSource()}
                            style={styles.avatar}
                        />
                        <TouchableOpacity style={styles.editBadge} onPress={pickImage}>
                            <Feather name="camera" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.phoneSub}>{formData.phone_number}</Text>
                </View>

                {/* Form Fields */}
                <View style={styles.form}>
                    <InputGroup
                        label="Full Name"
                        icon="user"
                        value={formData.fullname}
                        onChange={(t) => setFormData({ ...formData, fullname: t })}
                    />

                    <InputGroup
                        label="Username"
                        icon="at-sign"
                        value={formData.username}
                        onChange={(t) => setFormData({ ...formData, username: t })}
                        autoCapitalize="none"
                    />

                    <InputGroup
                        label="Email Address"
                        icon="mail"
                        value={formData.email}
                        onChange={(t) => setFormData({ ...formData, email: t })}
                        keyboardType="email-address"
                    />

                    <InputGroup
                        label="Student ID"
                        icon="hash"
                        value={formData.student_id}
                        onChange={(t) => setFormData({ ...formData, student_id: t })}
                        placeholder="Optional"
                    />

                    <Text style={styles.labelTitle}>Gender</Text>
                    <View style={styles.genderRow}>
                        {['male', 'female', 'other'].map((g) => (
                            <TouchableOpacity
                                key={g}
                                style={[styles.genderBtn, formData.gender === g && styles.genderBtnActive]}
                                onPress={() => setFormData({ ...formData, gender: g })}
                            >
                                <Text style={[styles.genderBtnText, formData.gender === g && styles.genderBtnTextActive]}>
                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity style={styles.logoutBtn}>
                    <Feather name="trash-2" size={18} color="#FF4B4B" />
                    <Text style={styles.logoutText}>Delete Account Data</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

type InputGroupProps = {
  label: string;
  icon: any;
  value: string;
  onChange: (value: string) => void;
  [key: string]: any;
};

const InputGroup = ({ label, icon, value, onChange, ...props }: InputGroupProps) => (
    <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
            <Feather name={icon} size={14} color="#64748B" />
            <Text style={styles.label}>{label}</Text>
        </View>
        <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholderTextColor="#94A3B8"
            {...props}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 60,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    navBtn: { width: 50, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
    saveText: { fontSize: 16, fontWeight: '600', color: '#2A2A68' },
    scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
    avatarSection: { alignItems: 'center', marginVertical: 25 },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    editBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: '#2A2A68',
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    phoneSub: { marginTop: 10, fontSize: 14, color: '#64748B', fontWeight: '500' },
    form: { gap: 18 },
    inputGroup: { width: '100%' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    label: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
    labelTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 8 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1E293B',
    },
    genderRow: { flexDirection: 'row', gap: 10 },
    genderBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    genderBtnActive: { backgroundColor: '#2A2A68', borderColor: '#2A2A68' },
    genderBtnText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
    genderBtnTextActive: { color: '#fff' },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 40,
        paddingVertical: 16,
        borderRadius: 15,
        backgroundColor: '#FFF1F1',
    },
    logoutText: { color: '#FF4B4B', fontWeight: '600', fontSize: 15 },
});