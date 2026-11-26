import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewLifeOnboarding() {
  return (
    <SafeAreaView style={styles.container}>
        <Text style={styles.logoText}>Payreece.</Text>

      <View style={styles.content}>
        

        <View style={styles.avatarContainer}>
          <View style={[styles.avatarWrapper, styles.leftAvatar]}>
            <Image 
              source={require('../assets/images/avatars/avatar1.jpg')}
              style={styles.avatarImage} 
            />
          </View>
          
          <View style={[styles.avatarWrapper, styles.rightAvatar]}>
            <Image 
              source={require('../assets/images/avatars/avatar2.jpg')}
              style={styles.avatarImage} 
            />
          </View>

          <View style={[styles.avatarWrapper, styles.centerAvatar]}>
            <Image 
              source={require('../assets/images/avatars/avatar3.jpg')}
              style={styles.avatarImage} 
            />
            
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            Borderless transfers{"\n"}made simple
           </Text>
            <Text style={styles.subtitle}>
             Move money across borders instantly and securely.
            </Text>

        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={()=> {router.push("/register")}} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Signup</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={()=> {router.push("/login")}}  style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Login</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A68', 
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingVertical: 70,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 30,
    paddingTop: 30,
    color: '#fff',
    marginTop: 20,
  },
  avatarContainer: {
    height: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  avatarWrapper: {
    width: 110,
    height: 110,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#FFF',
    overflow: 'hidden',
    backgroundColor: '#FFF',
    position: 'absolute',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  centerAvatar: {
    width: 130,
    height: 130,
    zIndex: 10,
    borderRadius: 30,
    bottom: 20,
  },
  leftAvatar: {
    left: 40,
    transform: [{ rotate: '-10deg' }],
    zIndex: 5,
  },
  rightAvatar: {
    right: 40,
    transform: [{ rotate: '10deg' }],
    zIndex: 5,
  },
  starBadge: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 15,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#2A2A68',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});