import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulseAnim = pulse;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <View style={styles.iconCircle}>
            <Ionicons name="flash" size={45} color="#fff" />
          </View>
        </Animated.View>
        <Text style={styles.logoText}><Text style={styles.logoBold}>Payreece.</Text></Text>
      </View>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color="#94A3B8" />
        <Text style={styles.loadingText}>Securing your connection...</Text>
        <Text style={styles.loadingText}>Cynite Technologies</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A68',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 55,
    height: 55,
    borderRadius: 25,
    backgroundColor: '#2A2A68',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 28,
    letterSpacing: -0.5,
    color: '#fff',
    fontWeight: '400',
  },
  logoBold: {
    fontWeight: '800',
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 4,
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.5,
  }
});