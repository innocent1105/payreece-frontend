import { BASE_URL } from '@/constants/api';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const ACTIVE_COLOR = '#2A2A68'; 
const INACTIVE_COLOR = '#999';
const CURRENCY = 'K'; 


const DialPad: React.FC<{ onKeyPress: (key: string) => void }> = ({ onKeyPress }) => {
    const numbers = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['.', '0', 'back'],
    ];

    

    const renderKey = (key: string) => (
        <TouchableOpacity
            key={key}
            style={dialPadStyles.keyButton}
            onPress={() => onKeyPress(key)}
            activeOpacity={key === 'back' ? 0.6 : 0.2}
        >
            {key === 'back' ? (
                <Ionicons name="backspace-outline" size={30} color="#000" />
            ) : (
                <Text style={dialPadStyles.keyText}>{key}</Text>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={dialPadStyles.container}>
            {numbers.map((row, rowIndex) => (
                <View key={rowIndex} style={dialPadStyles.row}>
                    {row.map(renderKey)}
                </View>
            ))}
        </View>
    );
};

const ReceiverList: React.FC = ({name, avatar}) => (
    <View style={styles.receiverListContainer}>
        <ReceiverAvatar 
            name={name}
            profileUrl={avatar}
        />
    </View>
);

const ReceiverAvatar: React.FC<{ name: string; isCurrentRecipient?: boolean; profileUrl?: string }> = ({ name, isCurrentRecipient = false, profileUrl }) => (
    <TouchableOpacity style={styles.receiverAvatarWrapper} onPress={() => Alert.alert("Change Recipient", `Selected ${name}`)}>
        <View style={[styles.receiverAvatar, isCurrentRecipient && styles.currentRecipientAvatar]}>
            {profileUrl ? (
                <Image source={{ uri: `${BASE_URL}/view_pp.php?file=${profileUrl}` }} style={styles.avatarImage} />
            ) : (
               <Text style={styles.receiverAvatarLetter}>{name.charAt(0)}</Text>
                // <Image source={{ uri: `${BASE_URL}/view_pp.php?file=${profileUrl}` }} style={styles.avatarImage} />
            )}
        </View>
        <Text style={[styles.receiverName, isCurrentRecipient && styles.currentRecipientName]}>{name}</Text>
    </TouchableOpacity>
);




export default function AmountScreen() {
    const [amount, setAmount] = useState('0'); 
    const { id, name, phone_number, avatar } = useLocalSearchParams();

    console.log(avatar)

    if(id == null){

    }

    const handleKeyPress = (key: string) => {
        setAmount(prevAmount => {
            if (key === 'back') {
                if (prevAmount.length <= 1) return '0';
                return prevAmount.slice(0, -1);
            }
            if (key === '.') {
                if (prevAmount.includes('.')) return prevAmount;
                return prevAmount + '.';
            }
            if (prevAmount.includes('.')) {
                const decimalPart = prevAmount.split('.')[1];
                if (decimalPart.length >= 2) return prevAmount;
            }
            else if (prevAmount.length >= 8) {
                return prevAmount;
            }

            if (prevAmount === '0') {
                return key;
            }

            return prevAmount + key;
        });
    };

    const handleQuickAmountPress = (value: number) => {
         setAmount(value.toString()); 
    };

    const formattedAmount = amount.includes('.') 
        ? amount 
        : `${amount}.00`;
    const isSendButtonDisabled = amount === '0' || amount === '0.';

    const recievingUser = {
        public_id : id,
        username : name,
        phone_number : phone_number,
        profile : avatar
    }

    const proceed = () => {
        router.push({
            pathname: "/send",
            params: {
                id : id,
                username : name,
                phone_number : phone_number,
                amount : amount
            }
        });
    }

    return (
        <View style={{ flex: 1 }}>
            <ParallaxScrollView
                headerHeight={100} 
                headerBackgroundColor={{ light: '#fff', dark: '#fff' }}
                headerImage={
                    <View style={styles.amountHeaderContent}>
                        <View style={styles.amountTopBar}>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Ionicons name="arrow-back" size={28} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.amountHeaderText}>Money Transfer</Text>
                            <TouchableOpacity onPress={() => {
                                router.push("/account");
                            }}>
                                <Ionicons name="person-circle-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ReceiverList name={recievingUser.username} avatar={avatar} />
                        <Text style={styles.sendingToText}>Sending to { recievingUser.username == "unknown-user" ? "an unregistered user" : recievingUser.username }</Text>
                    </View>
                }
            >
                <ThemedView style={dialPadStyles.mainSheet}>
                    <ScrollView contentContainerStyle={dialPadStyles.scrollContent}>
                        <Text style={styles.enterAmountText}>
                            Enter amount
                        </Text>

                        <View style={styles.amountDisplayContainer}>
                            <Text style={styles.currencyText}>{CURRENCY}</Text>
                            <Text style={styles.amountText}>{formattedAmount}</Text> 
                        </View>
                        
                        <View style={styles.quickSelectContainer}>
                            {[50, 100, 200, 500, 1000].map(val => (
                                <TouchableOpacity 
                                    key={val}
                                    style={styles.quickSelectButton}
                                    onPress={() => handleQuickAmountPress(val)}
                                >
                                    <Text style={styles.quickSelectText}>{CURRENCY} {val}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                    </ScrollView>
                    
                    <View style={dialPadStyles.bottomWrapper}>
                        <DialPad onKeyPress={handleKeyPress} />
                        <TouchableOpacity 
                            style={[dialPadStyles.sendButton, isSendButtonDisabled && dialPadStyles.sendButtonDisabled]}
                            disabled={isSendButtonDisabled}
                            onPress={() => {
                                proceed();
                            }}
                        >
                            <Text style={dialPadStyles.sendButtonText}>Proceed</Text>
                        </TouchableOpacity>
                    </View>
                    
                </ThemedView>
            </ParallaxScrollView>
        </View>
    );
}

const dialPadStyles = StyleSheet.create({
    mainSheet: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginTop: -30, 
        marginLeft: -30, 
        marginRight: -30, 
        marginBottom: 30, 
        marginHorizontal: 15, 
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        alignItems: 'center',
    },
    bottomWrapper: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20, 
    },
    container: {
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    keyButton: {
        width: '30%', 
        alignItems: 'center',
        justifyContent: 'center',
        height: 70, 
    },
    keyText: {
        fontSize: 32,
        fontWeight: '300', 
        color: '#000',
    },
    sendButton: {
        backgroundColor: ACTIVE_COLOR,
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 10,
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

const styles = StyleSheet.create({
    enterAmountText : {
        textAlign : "left",
        color : "#777",
        fontSize : 14
    },
    amountHeaderContent: {
        height: '100%',
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 50,
        backgroundColor: '#2A2A68', 
    },
    sendingToText : {
        textAlign : "center",
        fontSize : 12,
        color : "#fff"
    },
    amountTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    amountHeaderText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
     balanceContainer: {
        gap: 5,
    },
    balanceLabel: {
        color: '#ccc',
        fontSize: 14,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 10,
    },
    balanceAmount: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
    },
    
    receiverListContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 5,
        marginTop : 30
    },
    receiverAvatarWrapper: {
        alignItems: 'center',
        marginHorizontal: 8,
    },
    receiverAvatar: {
        width: 78,
        height: 78,
        borderRadius: 50,
        backgroundColor: '#f4f3ff3d',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        opacity: 1,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    currentRecipientAvatar: {
        opacity: 1,
        backgroundColor: ACTIVE_COLOR,
        borderColor: ACTIVE_COLOR,
    },
     receiverAvatarLetter: {
        color: "#fff",
        fontSize: 24,
        fontWeight: 'bold',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 50, 
    },
    receiverName: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
    },
    currentRecipientName: {
        color: ACTIVE_COLOR,
        fontWeight: '600',
    },

    amountDisplayContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        paddingVertical: 40,
        width: '100%',
    },
    currencyText: {
        fontSize: 55,
        fontWeight: '400',
        color: ACTIVE_COLOR,
        marginRight: 5,
    },
    amountText: {
        fontSize: 55,
        fontWeight: '400',
        color: ACTIVE_COLOR,
    },
    
    quickSelectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    quickSelectButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        margin: 5,
        borderRadius: 15,
        backgroundColor: '#f0f0f0',
    },
    quickSelectText: {
        fontSize: 14,
        color: '#555',
        fontWeight: '600',
    },
});