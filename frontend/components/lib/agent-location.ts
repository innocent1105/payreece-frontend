import * as Location from 'expo-location';
import { marketplace } from './marketplace';

export type AgentLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  mocked?: boolean;
};

export async function requestLocationPermission(): Promise<boolean> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === 'granted') {
    return true;
  }
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted';
}

export async function getForegroundLocation(): Promise<AgentLocation> {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error('Location permission is required to continue.');
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
    heading: position.coords.heading ?? undefined,
    speed: position.coords.speed ?? undefined,
    mocked: position.mocked ?? false,
  };
}

export async function sendAgentLocation(
  location: AgentLocation,
  transactionId?: number,
): Promise<{ next_update_seconds: number }> {
  return marketplace('agent.location', {
    method: 'POST',
    body: {
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy,
      heading: location.heading,
      speed: location.speed,
      mocked: location.mocked,
      transaction_id: transactionId,
    },
  });
}

export async function startForegroundLocationSharing(
  getTransactionId: () => number | undefined,
  onUpdate?: (intervalSeconds: number) => void,
): Promise<() => void> {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error('Location permission is required while you are available.');
  }

  let busy = false;
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 12000,
      distanceInterval: 5,
    },
    async (position) => {
      if (busy) {
        return;
      }
      busy = true;
      try {
        const result = await sendAgentLocation(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
            mocked: position.mocked ?? false,
          },
          getTransactionId(),
        );
        onUpdate?.(result.next_update_seconds ?? 12);
      } catch (error) {
        console.warn('Location update failed', error);
      } finally {
        busy = false;
      }
    },
  );

  return () => subscription.remove();
}
