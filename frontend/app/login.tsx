import { BASE_URL } from '@/constants/api';
import { saveToken } from '@/components/auth/auth';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
const ACTIVE_COLOR = '#2A2A68';
const BORDER_COLOR = '#B0C4DE';

interface CustomInputProps {
    iconName: keyof typeof Ionicons.glyphMap;
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'numeric' | 'phone-pad';
    maxLength?: number;
}

const CustomInput: React.FC<CustomInputProps> = ({ 
    iconName, 
    placeholder, 
    value, 
    onChangeText, 
    secureTextEntry = false, 
    keyboardType = 'default', 
    maxLength,
}) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPasswordInput = iconName === 'lock-closed-outline' || iconName === 'key-outline';

    return (
        <View style={styles.inputWrapper}>
            <Ionicons name={iconName} size={24} color="#666" style={styles.inputIcon} />
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#999"
                value={value}
                onChangeText={onChangeText}
                // Determine if the input should be hidden
                secureTextEntry={isPasswordInput && !isPasswordVisible} 
                keyboardType={keyboardType}
                maxLength={maxLength}
            />
            {isPasswordInput && (
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
            )}
        </View>
    );
};

export default function LoginScreen() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');

    const [formError, setFormError] : any = useState(false);
    const [formErrorMessage, setFormErrorMessage] : any = useState("Error");

    const [isLoggin, setIsLoggingIn] = useState(false);

    const isPhoneNumberValid = phoneNumber.length >= 10; 
    const isPasswordValid = password.length === 6; 
    const isFormValid = isPhoneNumberValid && isPasswordValid;

    const handleLogin = async () => {
        if (!isFormValid) {
            Alert.alert("Login Error", "Please enter a valid phone number and PIN/password.");
            return;
        }

        setIsLoggingIn(true);
        setFormError(false);
        setFormErrorMessage("");
   
        try {
            const data = {
                mobile_number: phoneNumber,
                password: password, 
            };

            const response = await axios.post(`${BASE_URL}/login.php`,
                data,
                {
                    timeout: 10000,
                }
            );

            console.log(response.data)
            if (response.data.success && response.data.token) {
                const token = response.data.token;
                await saveToken(token); 
                router.push("/");
            } else {
                setFormError(true);
                setFormErrorMessage(response.data.message);
            }

        } catch (error) {
            console.log("error")
            let errorMessage = "An unexpected error occurred. Please check your network.";
            
            if (axios.isAxiosError(error) && error.response) {
                errorMessage = error.response.data.message || "Invalid mobile number or PIN.";
            }

            setFormError(true);
            setFormErrorMessage(errorMessage);
        } finally {
            setIsLoggingIn(false);
        }
    };
    
    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                    Log in with your registered phone number and PIN.
                </Text>

                {formError && (
                    <View style={styles.formError}>
                        <Text style={styles.formErrorText}>
                            {formErrorMessage}
                        </Text>
                    </View>
                )}
                


                <View style={styles.formContainer}>
                    
                    <CustomInput
                        iconName="call-outline"
                        placeholder="Mobile Phone Number"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        maxLength={15}
                    />

                    <CustomInput
                        iconName="key-outline"
                        placeholder="4-6 Digit PIN or Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={true} 
                        keyboardType="numeric"
                        maxLength={6} // Consistent with registration PIN length
                    />

                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity onPress={() => router.push('/send')}>
                    <Text style={styles.forgotPasswordLink}>Forgot PIN/Password?</Text>
                </TouchableOpacity>

                {isLoggin ? (
                    <View
                        style={[styles.loginButton, !isFormValid && styles.disabledButton]}
                    >
                        <ActivityIndicator color={"#777"} size={18}/>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.loginButton, !isFormValid && styles.disabledButton]}
                        onPress={handleLogin}
                        disabled={!isFormValid}
                    >
                        <Text style={styles.loginButtonText}>Log In</Text>
                    </TouchableOpacity>
                )}
               

                {/* Register Link */}
                <View style={styles.registerLinkWrapper}>
                    <Text style={styles.registerText}>
                        Don&apos;t have an account?
                    </Text>
                    <TouchableOpacity onPress={() => router.replace('/register')}>
                        <Text style={styles.registerLink}>Register</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}
// ----------------------------------------------------------------------------------

// --- STYLESHEET (Shared and adapted from RegisterScreen) ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        paddingHorizontal: 25,
        paddingTop: 80, 
        paddingBottom: 50,
    },
    title: {
        fontSize: 30,
        fontWeight: 'bold',
        color: ACTIVE_COLOR,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 40,
        lineHeight: 22,
    },
    formContainer: {
        marginBottom: 10, 
    },

    formError: {
        backgroundColor : "#FCEAFF",
        borderWidth: 2,
        padding : 10,
        paddingHorizontal : 15,
        borderRadius : 10,
        marginBottom : 10,
        borderColor: "#F2003C"
    },
    formErrorText : {
        fontSize : 16,
        fontWeight : 500,
        color : "#F2003C"
    },

    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 20,
        height: 55,
        backgroundColor: '#f8f8f8',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingVertical: 10,
    },
    eyeButton: {
        padding: 5,
        marginLeft: 10,
    },
    
    // --- Link Styles ---
    forgotPasswordLink: {
        fontSize: 14,
        color: ACTIVE_COLOR,
        textAlign: 'right',
        marginBottom: 30,
        fontWeight: '600',
    },
    
    // --- Button Styles ---
    loginButton: {
        backgroundColor: ACTIVE_COLOR,
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 10,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    
    // --- Register Link ---
    registerLinkWrapper: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    registerText: {
        fontSize: 16,
        color: '#666',
    },
    registerLink: {
        fontSize: 16,
        color: ACTIVE_COLOR,
        fontWeight: 'bold',
        marginLeft: 5,
    },
});