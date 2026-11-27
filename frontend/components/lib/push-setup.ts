import { getToken } from '@/components/auth/auth';
import { registerForPushNotifications } from '@/components/lib/notifications';
import { BASE_URL } from '@/constants/api';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export async function setupMarketplacePush(): Promise<() => void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    if (data.screen === 'agent.request' || data.offer_id) {
      router.push('/agent/dashboard');
      return;
    }
    if (data.transaction_id) {
      router.push({
        pathname: '/marketplace/transaction',
        params: { transaction_id: String(data.transaction_id), role: String(data.role ?? 'customer') },
      });
      return;
    }
    if (data.request_id) {
      SecureStore.getItemAsync('marketplace_active_request')
        .then((stored) => {
          const active = stored ? JSON.parse(stored) : null;
          if (active?.transactionId) {
            router.push({ pathname: '/marketplace/map', params: { transaction_id: String(active.transactionId), role: 'customer' } });
          } else {
            router.push('/marketplace');
          }
        })
        .catch(() => router.push('/marketplace'));
    }
  });

  const token = await registerForPushNotifications();
  if (token) {
    const publicId = await getToken();
    if (publicId) {
      fetch(`${BASE_URL}/save-push-token.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ public_id: publicId, expo_token: token }),
      }).catch((error) => console.warn('Could not save push token', error));
    }
  }

  return () => responseSubscription.remove();
}
