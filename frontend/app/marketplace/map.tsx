import MapCanvas, { NearbyAgentMarker } from '@/components/marketplace/MapCanvas';
import BottomSheet from '@/components/marketplace/BottomSheet';
import { getForegroundLocation } from '@/components/lib/agent-location';
import { MarketplaceError, marketplace, newIdempotencyKey } from '@/components/lib/marketplace';
import { BASE_URL } from '@/constants/api';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Radius } from '@/constants/theme';

const ACTIVE_KEY = 'marketplace_active_request';
const POLL_MS = 4000;

type Role = 'customer' | 'agent';
type Point = { lat: number; lng: number };

const STATE_LABELS: Record<string, string> = {
  searching: 'Finding an agent',
  accepted: 'Agent accepted',
  agent_en_route: 'Agent on the way',
  arrived: 'Agent has arrived',
  processing: 'Exchange in progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  disputed: 'Disputed',
};

export default function MarketplaceMapScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<any>();
  const role: Role = params.role === 'agent' ? 'agent' : 'customer';

  const [location, setLocation] = useState<Point | null>(null);
  const [agents, setAgents] = useState<NearbyAgentMarker[]>([]);
  const [tx, setTx] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [radiusM, setRadiusM] = useState(3000);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(null);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [handoverCode, setHandoverCode] = useState('');
  const [metRecorded, setMetRecorded] = useState(false);

  const locationRef = useRef<Point | null>(null);
  const txRef = useRef<any>(null);
  const txIdRef = useRef<number | null>(params.transaction_id ? Number(params.transaction_id) : null);
  const requestIdRef = useRef<string>(String(params.request_public_id ?? params.public_id ?? ''));
  const idempotencyRef = useRef(newIdempotencyKey('request'));
  const lastStateRef = useRef('');
  const lastMetRef = useRef(false);
  const meetingPollRef = useRef(false);
  const initRef = useRef(false);
  const ratingPromptedRef = useRef<number | null>(null);

  const direction = String(params.direction ?? 'withdrawal');
  const network = String(params.network ?? 'MTN');
  const amount = String(params.amount ?? '0');
  const address = String(params.address ?? 'Near me');

  const applyTx = useCallback((details: any) => {
    txRef.current = details;
    setTx(details);
  }, []);

  const showBanner = useCallback((title: string, body: string) => {
    setBanner({ title, body });
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: null,
    }).catch(() => {});
    setTimeout(() => setBanner(null), 6000);
  }, []);

  const saveActive = useCallback(async (publicId: string, transactionId: number) => {
    requestIdRef.current = publicId;
    txIdRef.current = transactionId;
    try {
      await SecureStore.setItemAsync(ACTIVE_KEY, JSON.stringify({ role: 'customer', publicId, transactionId }));
    } catch {}
  }, []);

  const clearActive = useCallback(async () => {
    try { await SecureStore.deleteItemAsync(ACTIVE_KEY); } catch {}
    try { await SecureStore.deleteItemAsync('marketplace_active_agent'); } catch {}
  }, []);

  const resetToIdle = useCallback(async () => {
    await clearActive();
    requestIdRef.current = '';
    txIdRef.current = null;
    lastStateRef.current = '';
    lastMetRef.current = false;
    setRequest(null);
    applyTx(null);
    setAgents([]);
    setMetRecorded(false);
    setHandoverCode('');
    setRatingVisible(false);
    setError('');
  }, [clearActive, applyTx]);

  const loadNearby = useCallback(async (point: Point) => {
    try {
      const data = await marketplace<any>('customer.nearby_agents', {
        params: { lat: point.lat, lng: point.lng, network, direction, amount },
      });
      setAgents(data.agents ?? []);
      setRadiusM(data.radius_m ?? 3000);
    } catch (error) {
      if (!(error instanceof MarketplaceError)) setError('Could not load nearby agents.');
    }
  }, [network, direction, amount]);

  const createRequest = useCallback(async (point: Point) => {
    await loadNearby(point);
    idempotencyRef.current = newIdempotencyKey('request');
    const created = await marketplace<any>('customer.request.create', {
      method: 'POST',
      body: {
        direction,
        network,
        amount,
        pickup_address: address,
        pickup_lat: point.lat,
        pickup_lng: point.lng,
      },
      idempotencyKey: idempotencyRef.current,
    });
    setRequest(created);
    const createdTxId = Number(created?.transaction?.transaction_id ?? 0);
    if (createdTxId > 0) {
      await saveActive(String(created.public_id ?? ''), createdTxId);
      showBanner('Request sent', 'Searching for the closest available agent.');
    }
  }, [loadNearby, direction, network, amount, address, saveActive, showBanner]);

  const initialize = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;
    setBusy(true);
    setError('');
    try {
      const current = await getForegroundLocation();
      const point = { lat: current.lat, lng: current.lng };
      locationRef.current = point;
      setLocation(point);

      let resumedStatus: any = null;
      if (role === 'customer' && !txIdRef.current) {
        const stored = await SecureStore.getItemAsync(ACTIVE_KEY);
        let active: any = null;
        try { active = stored ? JSON.parse(stored) : null; } catch { active = null; }
        if (active?.publicId && active?.transactionId) {
          const publicId = String(active.publicId);
          try {
            resumedStatus = await marketplace<any>('customer.request.status', { params: { public_id: publicId } });
            const state = String(resumedStatus?.state ?? '');
            if (['completed', 'cancelled', 'expired', 'rejected', 'disputed'].includes(state)) {
              await resetToIdle();
            } else {
              requestIdRef.current = publicId;
              txIdRef.current = Number(active.transactionId);
            }
          } catch (err) {
            if (err instanceof MarketplaceError && (err.status === 404 || ['request_not_found', 'transaction_not_found'].includes(err.code))) {
              await resetToIdle();
            } else {
              throw err;
            }
          }
        } else {
          await resetToIdle();
        }
      }

      if (role === 'customer') {
        try {
          await marketplace('customer.location', { method: 'POST', body: { ...point, accuracy: current.accuracy, heading: current.heading, speed: current.speed, mocked: current.mocked } });
        } catch {}
      }

      if (role === 'customer' && !txIdRef.current) {
        await createRequest(point);
      } else if (role === 'customer' && resumedStatus) {
        setRequest(resumedStatus);
        if (resumedStatus?.transaction?.transaction_id) txIdRef.current = Number(resumedStatus.transaction.transaction_id);
      } else if (role === 'customer' && requestIdRef.current) {
        const status = await marketplace<any>('customer.request.status', { params: { public_id: requestIdRef.current } });
        setRequest(status);
        if (status?.transaction?.transaction_id) txIdRef.current = Number(status.transaction.transaction_id);
      }

      if (txIdRef.current) {
        const details = await marketplace<any>('transaction.get', { params: { transaction_id: txIdRef.current } });
        if (['cancelled', 'expired', 'rejected', 'disputed'].includes(String(details?.state ?? ''))) {
          await resetToIdle();
          if (role === 'customer') await createRequest(point);
          return;
        }
        applyTx(details);
        lastStateRef.current = details.state ?? '';
      }
    } catch (err) {
      if (role === 'customer' && err instanceof MarketplaceError && (err.status === 404 || ['request_not_found', 'transaction_not_found'].includes(err.code))) {
        await resetToIdle();
        if (locationRef.current) {
          try { await createRequest(locationRef.current); } catch { setError(''); }
        }
      } else {
        const message = err instanceof MarketplaceError ? err.message : 'Could not start the marketplace flow.';
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }, [role, createRequest, resetToIdle, applyTx]);

  const refresh = useCallback(async () => {
    try {
      if (role === 'customer' && requestIdRef.current) {
        let status: any;
        try {
          status = await marketplace<any>('customer.request.status', { params: { public_id: requestIdRef.current } });
        } catch (err) {
          if (err instanceof MarketplaceError && (err.status === 404 || ['request_not_found', 'transaction_not_found'].includes(err.code))) {
            await resetToIdle();
            if (locationRef.current) await loadNearby(locationRef.current);
            return;
          }
          throw err;
        }
        const state = String(status?.state ?? '');
        if (['completed', 'cancelled', 'expired', 'rejected', 'disputed'].includes(state)) {
          await resetToIdle();
          if (locationRef.current) await loadNearby(locationRef.current);
          return;
        }
        setRequest(status);
        if (status?.transaction?.transaction_id) txIdRef.current = Number(status.transaction.transaction_id);
      }

      if (txIdRef.current) {
        let details: any;
        try {
          details = await marketplace<any>('transaction.get', { params: { transaction_id: txIdRef.current } });
        } catch (err) {
          if (err instanceof MarketplaceError && (err.status === 404 || ['transaction_not_found', 'request_not_found'].includes(err.code))) {
            await resetToIdle();
            if (locationRef.current) await loadNearby(locationRef.current);
            return;
          }
          throw err;
        }
        applyTx(details);
        if (details.state !== lastStateRef.current) {
          lastStateRef.current = details.state ?? '';
          const title = STATE_LABELS[details.state] ?? 'Request update';
          if (['accepted', 'arrived', 'processing', 'completed'].includes(details.state)) {
            showBanner(title, 'Open the sheet to see the latest update.');
          }
        }
        if (['completed', 'cancelled', 'expired', 'rejected', 'disputed'].includes(details.state)) {
          await clearActive();
          if (['cancelled', 'expired', 'rejected', 'disputed'].includes(details.state)) {
            await resetToIdle();
            if (locationRef.current) await loadNearby(locationRef.current);
            return;
          }
        }
      } else if (role === 'customer' && locationRef.current) {
        await loadNearby(locationRef.current);
      }
    } catch (err) {
      if (err instanceof MarketplaceError && err.status !== 401) setError(err.message);
    }
  }, [role, loadNearby, resetToIdle, clearActive, showBanner, applyTx]);

  const checkMeeting = useCallback(async () => {
    if (!txIdRef.current || meetingPollRef.current || !locationRef.current) return;
    if (!txRef.current || !['accepted', 'agent_en_route', 'arrived', 'processing'].includes(txRef.current.state)) return;
    meetingPollRef.current = true;
    try {
      const result = await marketplace<any>('transaction.meet', {
        method: 'POST',
        body: { transaction_id: txIdRef.current, lat: locationRef.current.lat, lng: locationRef.current.lng },
      });
      if (result.met && !lastMetRef.current) {
        lastMetRef.current = true;
        setMetRecorded(true);
        showBanner('You have met', `Distance: ${Math.round(result.distance_m)} m. Complete the exchange safely.`);
      }
      if (result.state && result.state !== lastStateRef.current) {
        lastStateRef.current = result.state;
      }
      if (result.meeting) {
        applyTx({ ...(txRef.current ?? {}), meeting: result.meeting, state: result.state });
      }
    } catch {}
    finally {
      meetingPollRef.current = false;
    }
  }, [showBanner, applyTx]);

  useEffect(() => {
    const timer = setTimeout(() => { void initialize(); }, 0);
    return () => clearTimeout(timer);
  }, [initialize]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    const poll = setInterval(() => { void refresh(); }, POLL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let counter = 0;
    (async () => {
      try {
        const granted = await Location.getForegroundPermissionsAsync();
        if (granted.status !== 'granted') return;
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          async (position) => {
            const point = { lat: position.coords.latitude, lng: position.coords.longitude };
            locationRef.current = point;
            setLocation(point);
            if (role === 'customer') {
              counter += 1;
              if (counter % 3 === 0) {
                marketplace('customer.location', {
                  method: 'POST',
                  body: { ...point, accuracy: position.coords.accuracy ?? undefined, heading: position.coords.heading ?? undefined, speed: position.coords.speed ?? undefined, mocked: position.mocked ?? false },
                }).catch(() => {});
              }
            }
            void checkMeeting();
          },
        );
      } catch {}
    })();
    return () => subscription?.remove();
  }, [role, checkMeeting]);

  useEffect(() => {
    const timer = setTimeout(() => { void checkMeeting(); }, 0);
    return () => clearTimeout(timer);
  }, [tx?.state, checkMeeting]);

  const runAction = async (fn: () => Promise<any>, successMessage?: string) => {
    setActionBusy(true);
    setError('');
    try {
      const result = await fn();
      if (successMessage) showBanner(successMessage, 'The other person has been notified.');
      await refresh();
      return result;
    } catch (err) {
      const message = err instanceof MarketplaceError ? err.message : 'Action failed. Please try again.';
      setError(message);
      return null;
    } finally {
      setActionBusy(false);
    }
  };

  const cancel = async () => {
    if (role === 'customer' && requestIdRef.current) {
      const result = await runAction(() => marketplace('customer.request.cancel', {
        method: 'POST',
        body: { public_id: requestIdRef.current, reason: 'Cancelled by customer' },
        idempotencyKey: newIdempotencyKey('cancel'),
      }), 'Request cancelled');
      if (result) {
        await resetToIdle();
        setTimeout(() => router.back(), 300);
        return;
      }
      return;
    }
    if (!txIdRef.current) {
      setError('Request is still loading. Try again in a moment.');
      return;
    }
    const result = await runAction(() => marketplace('transaction.cancel', {
      method: 'POST',
      body: { transaction_id: txIdRef.current, reason: `Cancelled by ${role}` },
    }), 'Request cancelled');
    if (result) {
      await resetToIdle();
      setTimeout(() => router.back(), 300);
    }
  };

  const transition = async (action: 'en_route' | 'arrived' | 'processing') => {
    await runAction(() => marketplace('transaction.transition', {
      method: 'POST',
      body: { transaction_id: txIdRef.current, action },
    }));
  };

  const confirmCustomer = async () => {
    if (!tx || !tx.customer_confirmed_at) {
      await runAction(() => marketplace('transaction.confirm', {
        method: 'POST',
        body: { transaction_id: txIdRef.current, role: 'customer' },
      }));
    }
  };

  const submitRating = async () => {
    if (!txIdRef.current) return;
    await confirmCustomer();
    const result = await runAction(() => marketplace('transaction.rate', {
      method: 'POST',
      body: { transaction_id: txIdRef.current, rating, comment },
    }), 'Thanks for rating');
    if (result) {
      setRatingVisible(false);
      await refresh();
    }
  };

  const submitHandover = async () => {
    if (handoverCode.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit handover code.');
      return;
    }
    await runAction(() => marketplace('transaction.confirm', {
      method: 'POST',
      body: { transaction_id: txIdRef.current, role: 'agent', handover_code: handoverCode },
    }), 'Exchange completed');
  };

  const state = tx?.state ?? request?.state ?? 'searching';

  useEffect(() => {
    if (role !== 'customer' || state !== 'completed' || !txIdRef.current || tx?.my_rating) return;
    if (ratingPromptedRef.current === txIdRef.current) return;
    ratingPromptedRef.current = txIdRef.current;
    setRatingVisible(true);
  }, [role, state, tx?.my_rating]);

  const counterpart = role === 'customer'
    ? (tx?.location && tx?.state !== 'searching' ? tx.location : null)
    : (tx?.location ?? null);
  const agentProfile = tx?.agent ?? null;
  const isActive = ['accepted', 'agent_en_route', 'arrived', 'processing'].includes(state);
  const met = !!tx?.meeting || metRecorded;
  const showCancel = role === 'agent'
    ? ['accepted', 'agent_en_route', 'arrived'].includes(state)
    : ['searching', 'accepted', 'agent_en_route', 'arrived'].includes(state);

  const stateDetail = (() => {
    if (busy) {
      return role === 'agent'
        ? 'Opening your job and preparing the live map...'
        : 'Sending your request and locating verified agents...';
    }
    if (met) return `You met ${Math.round(Number(tx?.meeting?.distance_m ?? 0))} m apart.`;
    if (state === 'searching') {
      return role === 'agent'
        ? 'Waiting for the customer to confirm the exchange.'
        : `${agents.length} agent${agents.length === 1 ? '' : 's'} nearby. Waiting for an acceptance.`;
    }
    if (state === 'accepted') return role === 'agent' ? 'Head to the pickup point and start your journey.' : 'An agent accepted. They will start the journey shortly.';
    if (state === 'agent_en_route') return role === 'agent' ? 'Your live location is being shared with the customer.' : 'Your agent is on the way. Keep the app open for live updates.';
    if (state === 'arrived') return role === 'agent' ? 'Complete the task once the exchange is finished.' : 'Your agent has arrived at the pickup point.';
    if (state === 'processing') return 'Complete the exchange, then both parties confirm.';
    if (state === 'completed') return 'This request is complete. Thanks for using the marketplace.';
    if (state === 'cancelled') return 'This request was cancelled.';
    if (state === 'expired') return 'This request expired before an agent accepted.';
    if (state === 'disputed') return 'This request is under review.';
    return 'Tracking the latest status of your request.';
  })();

  const mapAgents = useMemo(() => (tx ? [] : agents), [tx, agents]);

  const avatarUri = (filename: string | null | undefined) =>
    filename ? `${BASE_URL}/view_pp.php?file=${encodeURIComponent(filename)}` : null;

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <MapCanvas
        user={location}
        counterpart={counterpart}
        agents={mapAgents}
        route={tx?.route?.polyline ?? []}
        radiusM={radiusM}
        showRadius={!tx && role === 'customer'}
        counterpartTitle={role === 'agent' ? 'Customer' : 'Agent'}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={[styles.roundButton, { backgroundColor: t.sheet }]}>
          <Ionicons name="arrow-back" size={20} color={t.text} />
        </Pressable>
        <View style={[styles.statusPill, { backgroundColor: t.sheet }]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? t.success : t.tint }]} />
          <Text style={[styles.statusText, { color: t.text }]}>{STATE_LABELS[state] ?? state.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      {banner ? (
        <View style={[styles.banner, { backgroundColor: t.sheet, borderColor: t.border }]}>
          <Ionicons name="notifications" size={18} color={t.tint} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: t.text }]}>{banner.title}</Text>
            <Text style={[styles.bannerBody, { color: t.textSecondary }]}>{banner.body}</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={[styles.errorToast, { color: t.danger }]}>{error}</Text> : null}

      <BottomSheet visible onClose={() => router.back()} dismissible={false} mapOverlay>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.sheetState, { borderColor: t.border }]}>
            <View style={[styles.sheetStateIcon, { backgroundColor: isActive ? t.successSoft : t.accentSoftBg }]}>
              <Ionicons
                name={busy ? 'hourglass-outline' : isActive ? 'navigate-outline' : 'radio-outline'}
                size={18}
                color={isActive ? t.success : t.tint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetStateTitle, { color: t.text }]}>{STATE_LABELS[state] ?? state.replace(/_/g, ' ')}</Text>
              <Text style={[styles.sheetText, { color: t.textSecondary }]}>{stateDetail}</Text>
            </View>
            {busy ? <ActivityIndicator size="small" color={t.tint} /> : null}
          </View>

          {role === 'customer' && !agentProfile ? (
            <>
              <Text style={[styles.sheetTitle, { color: t.text }]}>Finding nearby agents</Text>
              <Text style={[styles.sheetText, { color: t.textSecondary }]}>
                {agents.length > 0
                  ? `${agents.length} agent${agents.length === 1 ? '' : 's'} available around you.`
                  : 'Looking for verified agents with your network and amount.'}
              </Text>
              <View style={styles.summaryRow}>
                <InfoPill label="Network" value={network} />
                <InfoPill label="Amount" value={`K${amount}`} />
                <InfoPill label="Mode" value={direction === 'withdrawal' ? 'Withdraw' : 'Deposit'} />
              </View>
              {!busy ? (
                <View style={styles.waitingRow}>
                  <ActivityIndicator size="small" color={t.tint} />
                  <Text style={[styles.sheetText, { color: t.textSecondary }]}>Waiting for an agent to accept.</Text>
                </View>
              ) : null}
              {showCancel ? (
                <Pressable disabled={actionBusy} onPress={() => void cancel()} style={[styles.secondaryButton, { borderColor: t.border }]}>
                  <Text style={{ color: t.danger, fontWeight: '700' }}>{actionBusy ? 'Cancelling...' : 'Cancel request'}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {role === 'agent' && !tx?.agent ? (
            <>
              <Text style={[styles.sheetTitle, { color: t.text }]}>Opening job</Text>
              <Text style={[styles.sheetText, { color: t.textSecondary }]}>Loading your assigned request...</Text>
            </>
          ) : null}

          {agentProfile || role === 'agent' ? (
            <>
              <View style={styles.profileRow}>
                {avatarUri(role === 'agent' ? tx?.customer?.avatar : agentProfile?.avatar) ? (
                  <Image
                    source={{ uri: avatarUri(role === 'agent' ? tx?.customer?.avatar : agentProfile?.avatar)! }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: t.accentSoftBg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person" size={24} color={t.tint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: t.text }]}>
                    {role === 'agent' ? (tx?.customer?.name ?? 'Customer') : (agentProfile?.name ?? 'Agent')}
                  </Text>
                  <Text style={[styles.sheetText, { color: t.textSecondary }]}>
                    {role === 'agent' ? 'Customer waiting for pickup' : (agentProfile?.business_name ?? 'Nearby agent')}
                  </Text>
                  {role === 'customer' && agentProfile ? (
                    <Text style={[styles.ratingText, { color: t.warning }]}>★ {Number(agentProfile.rating ?? 0).toFixed(1)} ({agentProfile.rating_count ?? 0})</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.summaryRow}>
                <InfoPill label="Amount" value={`K${tx?.amount ?? amount}`} />
                <InfoPill label="Network" value={tx?.network ?? network} />
                <InfoPill label="Mode" value={(tx?.direction ?? direction) === 'withdrawal' ? 'Withdraw' : 'Deposit'} />
              </View>

              <Text style={[styles.statusDetail, { color: t.textSecondary }]}>
                {met
                  ? `You met ${Math.round(Number(tx?.meeting?.distance_m ?? 0))} m apart.`
                  : state === 'processing'
                    ? 'Complete the exchange, then both parties confirm.'
                    : 'Follow the route on the map. Keep the app open for live location.'}
              </Text>

              {role === 'agent' && ['accepted'].includes(state) ? (
                <Pressable disabled={actionBusy} onPress={() => void transition('en_route')} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
                  <Text style={styles.primaryText}>Start journey</Text>
                </Pressable>
              ) : null}
              {role === 'agent' && state === 'agent_en_route' ? (
                <Pressable disabled={actionBusy} onPress={() => void transition('arrived')} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
                  <Text style={styles.primaryText}>Arrived · complete request</Text>
                </Pressable>
              ) : null}
              {role === 'agent' && state === 'arrived' ? (
                <Pressable disabled={actionBusy} onPress={() => void transition('arrived')} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
                  <Text style={styles.primaryText}>Complete request</Text>
                </Pressable>
              ) : null}

              {role === 'agent' && state === 'processing' ? (
                tx?.customer_confirmed_at ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>Enter customer handover code</Text>
                    <TextInput
                      value={handoverCode}
                      onChangeText={setHandoverCode}
                      keyboardType="numeric"
                      maxLength={6}
                      placeholder="000000"
                      placeholderTextColor={t.textMuted}
                      style={[styles.codeInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
                    />
                    <Pressable disabled={actionBusy} onPress={() => void submitHandover()} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
                      <Text style={styles.primaryText}>Confirm completion</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={[styles.statusDetail, { color: t.textSecondary }]}>Waiting for the customer to confirm the exchange.</Text>
                )
              ) : null}

              {role === 'customer' && state === 'processing' ? (
                <>
                  <View style={[styles.codeBox, { backgroundColor: t.accentSoftBg }]}>
                    <Text style={[styles.codeLabel, { color: t.textSecondary }]}>Handover code</Text>
                    <Text style={[styles.codeValue, { color: t.tint }]}>{tx?.handover_code ?? '------'}</Text>
                  </View>
                  <Pressable
                    disabled={actionBusy}
                    onPress={() => void confirmCustomer()}
                    style={[styles.secondaryButton, { borderColor: t.border }]}
                  >
                    <Text style={{ color: t.text, fontWeight: '700' }}>
                      {tx?.customer_confirmed_at ? 'Confirmed' : 'I confirmed the exchange'}
                    </Text>
                  </Pressable>
                  {tx?.customer_confirmed_at ? (
                    <Pressable disabled={actionBusy} onPress={() => setRatingVisible(true)} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
                      <Text style={styles.primaryText}>Rate agent</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {role === 'customer' && state === 'completed' ? (
                tx?.my_rating ? (
                  <Text style={[styles.statusDetail, { color: t.success }]}>Thanks for rating {agentProfile?.name ?? 'your agent'}.</Text>
                ) : (
                  <Pressable onPress={() => setRatingVisible(true)} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
                    <Text style={styles.primaryText}>Rate agent</Text>
                  </Pressable>
                )
              ) : null}

              {showCancel ? (
                <Pressable disabled={actionBusy} onPress={() => void cancel()} style={[styles.secondaryButton, { borderColor: t.border }]}>
                  <Text style={{ color: t.danger, fontWeight: '700' }}>{actionBusy ? 'Cancelling...' : 'Cancel request'}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={ratingVisible} onClose={() => setRatingVisible(false)} title="Rate this agent">
        <Text style={[styles.sheetText, { color: t.textSecondary }]}>How was your experience with {agentProfile?.name ?? 'the agent'}?</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} hitSlop={6}>
              <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={34} color={star <= rating ? t.warning : t.textMuted} />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Add a short comment (optional)"
          placeholderTextColor={t.textMuted}
          multiline
          style={[styles.commentInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
        />
        <Pressable disabled={actionBusy} onPress={() => void submitRating()} style={[styles.primaryButton, { backgroundColor: t.tint }]}>
          <Text style={styles.primaryText}>{actionBusy ? 'Submitting...' : 'Submit rating'}</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  const t = useAppTheme();
  return (
    <View style={[styles.infoPill, { backgroundColor: t.inputBg }]}>
      <Text style={[styles.infoLabel, { color: t.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: t.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 3 },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: Radius.pill, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },
  banner: { position: 'absolute', top: 110, left: 16, right: 16, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: Radius.md, borderWidth: 1, zIndex: 3 },
  bannerTitle: { fontSize: 14, fontWeight: '700' },
  bannerBody: { fontSize: 12, marginTop: 2 },
  errorToast: { position: 'absolute', top: 180, left: 24, right: 24, textAlign: 'center', fontSize: 13, fontWeight: '600', zIndex: 3 },
  sheetState: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, borderWidth: 1, marginBottom: 16 },
  sheetStateIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sheetStateTitle: { fontSize: 15, fontWeight: '700' },
  sheetTitle: { fontSize: 19, fontWeight: '700' },
  sheetText: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 12 },
  infoPill: { flex: 1, padding: 10, borderRadius: Radius.sm },
  infoLabel: { fontSize: 11, fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  statusDetail: { fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 12 },
  primaryButton: { paddingVertical: 15, borderRadius: Radius.md, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, marginTop: 8 },
  codeBox: { padding: 14, borderRadius: Radius.md, alignItems: 'center', marginTop: 10 },
  codeLabel: { fontSize: 12, fontWeight: '600' },
  codeValue: { fontSize: 32, fontWeight: '800', letterSpacing: 6, marginTop: 4 },
  codeInput: { borderWidth: 1, borderRadius: Radius.md, paddingVertical: 13, paddingHorizontal: 16, fontSize: 22, letterSpacing: 6, textAlign: 'center', marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginTop: 12 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  commentInput: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 8 },
});
