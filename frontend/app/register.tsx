import { BASE_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
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
    keyboardType?: 'default' | 'numeric' | 'email-address';
    maxLength?: number;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

type Gender = 'male' | 'female' | 'other' | '';

const CustomInput: React.FC<CustomInputProps> = ({ 
    iconName, 
    placeholder, 
    value, 
    onChangeText, 
    secureTextEntry = false, 
    keyboardType = 'default', 
    maxLength,
    autoCapitalize = 'none',
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
                secureTextEntry={isPasswordInput && !isPasswordVisible}
                keyboardType={keyboardType}
                maxLength={maxLength}
                autoCapitalize={autoCapitalize}
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

interface GenderSelectorProps {
    selectedGender: Gender;
    onSelect: (gender: Gender) => void;
}

const GenderSelector: React.FC<GenderSelectorProps> = ({ selectedGender, onSelect }) => {
    const genders: Gender[] = ['male', 'female'];
    return (
        <View style={styles.genderContainer}>
            <View style={styles.genderOptions}>
                {genders.map((gender) => {
                    const isSelected = selectedGender === gender;
                    return (
                        <TouchableOpacity
                            key={gender}
                            style={[
                                styles.genderButton,
                                isSelected && styles.genderButtonSelected,
                            ]}
                            onPress={() => onSelect(gender)}
                        >
                            <Text style={[
                                styles.genderButtonText,
                                isSelected && styles.genderButtonTextSelected,
                            ]}>
                                {gender}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default function RegisterScreen() {
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [gender, setGender] = useState<Gender>('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [formError, setFormError] = useState(false);
    const [formErrorMessage, setFormErrorMessage] = useState("Error");
    
    const [isLoading, setIsLoading] = useState(false);

    const isFullNameValid = fullName.trim().length >= 4;
    const isPhoneNumberValid = phoneNumber.length >= 10;
    const isGenderSelected = gender !== '';
    const isPasswordValid = password.length === 6;
    const passwordsMatch = password === confirmPassword && password.length > 0;
    const isFormValid = isFullNameValid && isPhoneNumberValid && isGenderSelected && isPasswordValid && passwordsMatch;

    const handleRegister = async () => {
        if (!isFormValid) {
            let message = "Please fix the following issues:";
            if (!isFullNameValid) message += "\n- Full Name is required (min 4 chars).";
            if (!isPhoneNumberValid) message += "\n- Valid phone number required (min 10 digits).";
            if (!isGenderSelected) message += "\n- Please select your gender.";
            if (!isPasswordValid) message += "\n- PIN must be 6 digits.";
            if (!passwordsMatch) message += "\n- PINs must match.";
            
            
            return;
        }

        setIsLoading(true);
        setFormError(false);
        setFormErrorMessage("");

        

        const payload = {
            username: fullName.trim(),
            mobile_number: phoneNumber.trim(),
            gender,
            password,
        };

        try {
            const response = await axios.post(`${BASE_URL}/register.php`,
                payload,
                {
                    timeout: 10000,
                }
            );

            console.log(response.data)
            if (response.data?.success) {
                router.push("/login");
            } else {
                setFormError(true);
                setFormErrorMessage(response.data.message);
            }
        } catch (error: any) {
            console.log(error);
            setFormError(true);
            setFormErrorMessage("Unable to register right now. Please check your connection and try again.");
        }finally{
            setIsLoading(false);
        }
    };

    
    return (
        <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
  <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Create New Account</Text>
                <Text style={styles.subtitle}>
                    Enter your details below to set up your mobile money account.
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
                        iconName="person-outline"
                        placeholder="Full Name (e.g., John Banda)"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                    />

                    <CustomInput
                        iconName="call-outline"
                        placeholder="Mobile Phone Number (+260977)"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="numeric"
                        maxLength={15}
                    />
                    <Text style={styles.genderLabel}>Gender</Text>
                    <GenderSelector selectedGender={gender} onSelect={setGender} />
                    
                    <CustomInput
                        iconName="key-outline"
                        placeholder="Create 6-digit PIN"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={true} 
                        keyboardType="numeric"
                        maxLength={6}
                    />

                    <CustomInput
                        iconName="lock-closed-outline"
                        placeholder="Confirm PIN"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={true}
                        keyboardType="numeric"
                        maxLength={6}
                    />
                    
                    {password.length > 0 && confirmPassword.length > 0 && !passwordsMatch && (
                        <Text style={styles.errorText}>PINs do not match!</Text>
                    )}

                </View>

                {isLoading ? (
                    <TouchableOpacity
                        style={[styles.registerButton, !isFormValid && styles.disabledButton]}
                        disabled={!isFormValid}
                    >
                        <ActivityIndicator color={"#777"} size={18}/>
                    </TouchableOpacity>

                ) : (
                    <TouchableOpacity
                        style={[styles.registerButton, !isFormValid && styles.disabledButton]}
                        onPress={handleRegister}
                        disabled={!isFormValid}
                    >
                        <Text style={styles.registerButtonText}>Register</Text>
                    </TouchableOpacity>

                )}
                
                
             


                <View style={styles.loginLinkWrapper}>
                    <Text style={styles.loginText}>
                        Already have an account? 
                    </Text>
                    <TouchableOpacity onPress={() => router.replace('/login')}>
                        <Text style={styles.loginLink}>Log In</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
        </KeyboardAvoidingView>
      
    );
}

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
        marginBottom: 30,
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
    errorText: {
        color: '#E91E63',
        fontSize: 13,
        textAlign: 'right',
        marginTop: -10,
        marginBottom: 10,
    },
    
    genderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    genderLabel: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    genderOptions: {
        flexDirection: 'row',
        flex: 1,
        justifyContent: 'space-between',
    },
    genderButton: {
        flex: 1,
        paddingVertical: 10,
        marginHorizontal: 4,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: BORDER_COLOR,
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
    },
    genderButtonSelected: {
        borderColor: ACTIVE_COLOR,
        backgroundColor: ACTIVE_COLOR + '10',
    },
    genderButtonText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    genderButtonTextSelected: {
        color: ACTIVE_COLOR,
        fontWeight: 'bold',
    },
    
    // --- Button Styles ---
    registerButton: {
        backgroundColor: ACTIVE_COLOR,
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 2,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    
    loginLinkWrapper: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    loginText: {
        fontSize: 16,
        color: '#666',
    },
    loginLink: {
        fontSize: 16,
        color: ACTIVE_COLOR,
        fontWeight: 'bold',
        marginLeft: 5,
    },
});