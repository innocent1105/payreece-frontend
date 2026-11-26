import { getToken } from '@/components/auth/auth';
import { BASE_URL } from '@/constants/api';

export class MarketplaceError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type MarketplaceOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  body?: Record<string, unknown>;
  params?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
};

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function marketplace<T = any>(
  action: string,
  options: MarketplaceOptions = {},
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new MarketplaceError('Please sign in again.', 'unauthenticated', 401);
  }

  const query = new URLSearchParams({ action });
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${BASE_URL}/marketplace.php?${query.toString()}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify({ ...options.body, token }) : undefined,
  });

  return parseResponse<T>(response);
}

export async function marketplaceUpload<T = any>(
  action: string,
  body: FormData,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new MarketplaceError('Please sign in again.', 'unauthenticated', 401);
  }
  body.append('token', token);

  const response = await fetch(`${BASE_URL}/marketplace.php?action=${encodeURIComponent(action)}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: any;
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new MarketplaceError('Invalid server response.', 'invalid_response', response.status);
  }

  if (!response.ok || result.success === false) {
    throw new MarketplaceError(
      result.message || 'Request failed.',
      result.code || 'request_failed',
      response.status,
    );
  }
  return result.data as T;
}
