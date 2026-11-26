import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Must use physical device for push notifications');
    return null;
  }

  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    console.warn('Android push notifications require a development build; skipping in Expo Go');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Ask user if permission not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token permissions');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '3fd37782-1a81-4e33-8e0e-732aa7c10b03',
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get Expo push token:', error);
    return null;
  }
}
