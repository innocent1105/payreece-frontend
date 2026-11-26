import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type CustomTabBarProps = {
    state: { routes: { key: string; name: string }[]; index: number };
    descriptors: Record<string, { options: { title?: string } }>;
    emitter: {
        emit: (event: {
            type: string;
            target: string;
            canPreventDefault?: boolean;
        }) => { defaultPrevented: boolean };
    };
    navigateToTab: (routeKey: string) => void;
};

function CustomTabBar({ state, descriptors, emitter, navigateToTab }: CustomTabBarProps) {
    const inactiveColor = '#8E8E93';
    const activeColor = '#2A2A68';
  
    return (
        <View style={styles.tabBarContainer}>
            {state.routes.map((route : any, index : any) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;

                const onPress = () => {
                    const event = emitter.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigateToTab(route.key);
                    }
                };

                let iconName: keyof typeof Ionicons.glyphMap;
                let label = options.title !== undefined ? options.title : route.name;

                if (route.name === 'index') {
                    iconName = isFocused ? 'card' : 'card-outline';
                    label = 'Wallet';
                } else if (route.name === 'explore') {
                    iconName = 'add-circle-outline'; 
                } else if (route.name === 'account') {
                    iconName = isFocused ? 'person-circle' : 'person-circle-outline';
                    label = 'Account';
                } else {
                    iconName = isFocused ? 'document' : 'document-outline';
                }
            
                if (index === 1) {
                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={styles.fabButton}
                            activeOpacity={0.8}
                        >
                   
                            <Ionicons name={iconName} size={28} color="white" />
                        </TouchableOpacity>
                    );
                }

                return (
                    <TouchableOpacity
                        key={route.key}
                        onPress={onPress}
                        style={styles.tabItem}
                    >
                 
                        <Ionicons 
                            name={iconName} 
                            size={24} 
                            color={isFocused ? activeColor : inactiveColor} 
                        />
                        
                        <Text style={[
                            styles.tabLabel, 
                            { color: isFocused ? activeColor : inactiveColor }
                        ]}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarBackground: () => <View style={{ backgroundColor: 'transparent' }} />,
            }}>
            
            <Tabs.Screen name="index" options={{ title: 'Wallet' }} />
            <Tabs.Screen name="explore" options={{ title: 'Scan' }} />
            <Tabs.Screen name="account" options={{ title: 'Account' }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 50,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 35,
        height: 70,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flex: 1,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    fabButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#2A2A68',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40, 
        shadowColor: '#2A2A68',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 4,
        borderColor: '#f2f2f2', 
    },
});