import Constants from 'expo-constants';

const DEFAULT_API_URL = 'http://192.168.1.81/ipay/backend';

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/backend\/+$/i, '/backend');
}

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
  const packagerHost = Constants.expoConfig?.hostUri?.split(':')[0];

  if (!packagerHost) {
    return normalizeUrl(configured);
  }

  return normalizeUrl(
    configured.replace(
      /^(https?:\/\/)(localhost|127\.0\.0\.1)/i,
      `$1${packagerHost}`,
    ),
  );
}

export const BASE_URL = resolveApiUrl();
