import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- CONFIG ---
const ACTIVE_COLOR = '#2A2A68'; // Primary app color (Dark Blue)
const BORDER_COLOR = '#B0C4DE'; // Light border color

// --- 1. ENTER PASSWORD CARD COMPONENT ---
export default function EnterPasswordCard({ }) {
    
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isButtonDisabled = password.length < 4; // Simple check for a minimum PIN/password length

    return (
        // The modal overlay wrapper (if this component is used as a full-screen modal)
        <View style={styles.modalOverlay}> 
            
            <View style={styles.cardContainer}>
               
                {/* Password Input Field */}
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your PIN or Password"
                        placeholderTextColor="#999"
                        keyboardType="numeric" // Use numeric for PINs, default for passwords
                        secureTextEntry={!isPasswordVisible} // Hide/show based on state
                        value={password}
                        onChangeText={setPassword}
                        maxLength={6} // Example limit for a typical PIN/short password
                    />
                    
                    {/* Toggle Button for Visibility */}
                    <TouchableOpacity 
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)} 
                        style={styles.eyeButton}
                    >
                        <Ionicons 
                            name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                            size={24} 
                            color="#666" 
                        />
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={() => Alert.alert("Reset", "Initiating password reset flow...")}>
                    <Text style={styles.forgotPasswordText}>Forgot PIN/Password?</Text>
                </TouchableOpacity>


            </View>
        </View>
    );
}
// ----------------------------------------------------------------------------------

// --- STYLESHEET ---
const styles = StyleSheet.create({
    modalOverlay: {
        // Use these properties to center the card on the screen 
        // when used as a modal overlay (e.g., in a parent Modal component)
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    },
    cardContainer: {
        width: '90%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 5,
    },

    // Summary Context
    summaryContainer: {
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    summaryText: {
        fontSize: 14,
        color: '#666',
    },
    amountText: {
        fontSize: 34,
        fontWeight: '900',
        color: ACTIVE_COLOR,
        marginVertical: 5,
    },

    // Input
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 10,
        height: 55,
    },
    input: {
        flex: 1,
        fontSize: 18,
        color: '#333',
        paddingVertical: 10,
    },
    eyeButton: {
        padding: 5,
    },

    // Links
    forgotPasswordText: {
        fontSize: 14,
        color: ACTIVE_COLOR,
        textAlign: 'right',
        marginTop: 5,
        marginBottom: 25,
    },
    
    // Button
    confirmButton: {
        backgroundColor: ACTIVE_COLOR,
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    }
});