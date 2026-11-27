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

export async function marketplaceHistory(limit = 50): Promise<any[]> {
  const data = await marketplace<any>('request.history', { params: { limit } });
  return data?.history ?? [];
}

export async function listNudges(limit = 30): Promise<{ notifications: any[]; unread_count: number }> {
  const data = await marketplace<any>('notifications.list', { params: { limit } });
  return { notifications: data?.notifications ?? [], unread_count: Number(data?.unread_count ?? 0) };
}

export async function markNudgesRead(ids?: number[]): Promise<void> {
  await marketplace('notifications.mark_read', {
    method: 'POST',
    body: ids?.length ? { ids } : {},
  });
}

export function marketplaceActivity(item: any) {
  const state = String(item?.state ?? 'searching').toLowerCase();
  const role = item?.role === 'agent' ? 'agent' : 'customer';
  const direction = item?.direction === 'deposit' ? 'Deposit' : 'Withdrawal';
  const counterparty = item?.counterparty || (role === 'agent' ? 'Customer' : 'Agent');

  const titles: Record<string, string> = {
    searching: `${direction} request searching`,
    matched: `${direction} request matched`,
    accepted: `${direction} accepted · ${counterparty}`,
    agent_en_route: `${direction} · agent on the way`,
    arrived: `${direction} · agent arrived`,
    processing: `${direction} · exchange in progress`,
    completed: `${direction} completed · ${counterparty}`,
    cancelled: `${direction} cancelled`,
    expired: `${direction} expired`,
    rejected: `${direction} rejected`,
    disputed: `${direction} disputed`,
  };

  return {
    id: `mm-${item?.transaction_id ?? item?.public_id}`,
    type: 'marketplace',
    transaction_id: item?.transaction_id,
    public_id: item?.public_id,
    role,
    state,
    direction: item?.direction,
    network: item?.network,
    counterparty,
    counterparty_avatar: item?.counterparty_avatar,
    from_me: role === 'customer',
    amount: item?.amount,
    date: item?.date,
    title: titles[state] ?? `${direction} request`,
    status: state.replace(/_/g, ' '),
  };
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
