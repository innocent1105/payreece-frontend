import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/map-style';
import { useAppTheme } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type MapPoint = { lat: number | string | null | undefined; lng: number | string | null | undefined };

export type NearbyAgentMarker = MapPoint & {
  agent_id?: number;
  name?: string;
  business_name?: string;
  rating_avg?: number;
  distance_m?: number;
};

type Props = {
  user?: MapPoint | null;
  counterpart?: MapPoint | null;
  agents?: NearbyAgentMarker[];
  route?: [number, number][] | null;
  radiusM?: number;
  showRadius?: boolean;
  counterpartTitle?: string;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function MapCanvas({
  user,
  counterpart,
  agents = [],
  route = [],
  radiusM = 3000,
  showRadius = false,
  counterpartTitle = 'Destination',
}: Props) {
  const t = useAppTheme();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const mapRef = useRef<MapView | null>(null);
  const [pulse] = useState(() => new Animated.Value(0));

  const visualRadiusM = Math.min(radiusM, 900);
  const pulseRadius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [visualRadiusM * 0.32, visualRadiusM],
  });

  const userLat = toNumber(user?.lat);
  const userLng = toNumber(user?.lng);
  const otherLat = toNumber(counterpart?.lat);
  const otherLng = toNumber(counterpart?.lng);

  const points = (route ?? [])
    .map((point) => ({ latitude: toNumber(point[0]), longitude: toNumber(point[1]) }))
    .filter((point): point is { latitude: number; longitude: number } => point.latitude !== null && point.longitude !== null);

  const region = useMemo(() => {
    if (userLat !== null && userLng !== null && otherLat !== null && otherLng !== null) {
      const latDelta = Math.max(0.008, Math.abs(userLat - otherLat) * 1.6);
      const lngDelta = Math.max(0.008, Math.abs(userLng - otherLng) * 1.6);
      return { latitude: (userLat + otherLat) / 2, longitude: (userLng + otherLng) / 2, latitudeDelta: latDelta, longitudeDelta: lngDelta };
    }
    if (userLat !== null && userLng !== null) {
      const delta = Math.max(0.012, (visualRadiusM / 111320) * 4.5);
      return { latitude: userLat, longitude: userLng, latitudeDelta: delta, longitudeDelta: delta };
    }
    const first = agents.find((agent) => toNumber(agent.lat) !== null && toNumber(agent.lng) !== null);
    if (first) {
      return { latitude: toNumber(first.lat)!, longitude: toNumber(first.lng)!, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    }
    return { latitude: -15.3875, longitude: 28.3228, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [userLat, userLng, otherLat, otherLng, visualRadiusM, agents]);

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 600);
  }, [region]);

  useEffect(() => {
    if (!showRadius) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 280, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.42, duration: 260, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.85, duration: 240, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.32, duration: 720, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, showRadius]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        showsUserLocation
        showsMyLocationButton
        scrollEnabled
        zoomEnabled
      >
        {showRadius && userLat !== null && userLng !== null ? (
          <>
            <AnimatedCircle
              center={{ latitude: userLat, longitude: userLng }}
              radius={pulseRadius}
              strokeColor={t.tint}
              fillColor="rgba(10,132,255,0.10)"
              strokeWidth={2}
            />
            <Circle
              center={{ latitude: userLat, longitude: userLng }}
              radius={visualRadiusM * 0.18}
              strokeColor={t.tint}
              fillColor="rgba(10,132,255,0.18)"
              strokeWidth={1}
            />
          </>
        ) : null}
        {agents.map((agent, index) => {
          const lat = toNumber(agent.lat);
          const lng = toNumber(agent.lng);
          if (lat === null || lng === null) return null;
          return (
            <Marker
              key={agent.agent_id ?? `agent-${index}`}
              coordinate={{ latitude: lat, longitude: lng }}
              pinColor={t.tint}
              title={agent.business_name || agent.name || 'Agent nearby'}
              description={`${agent.rating_avg ? `★ ${agent.rating_avg.toFixed(1)} · ` : ''}${Math.round(agent.distance_m ?? 0)} m away`}
            />
          );
        })}
        {userLat !== null && userLng !== null ? (
          <Marker coordinate={{ latitude: userLat, longitude: userLng }} title="You" pinColor="#30D158" />
        ) : null}
        {otherLat !== null && otherLng !== null ? (
          <Marker coordinate={{ latitude: otherLat, longitude: otherLng }} title={counterpartTitle} pinColor="#FF453A" />
        ) : null}
        {points.length > 1 ? <Polyline coordinates={points} strokeColor={t.tint} strokeWidth={4} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
