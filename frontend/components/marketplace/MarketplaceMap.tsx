import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

type Props = {
  lat?: number | string | null;
  lng?: number | string | null;
  counterpartLat?: number | string | null;
  counterpartLng?: number | string | null;
  polyline?: [number, number][] | null;
  title?: string;
  counterpartTitle?: string;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function MarketplaceMap({
  lat,
  lng,
  counterpartLat,
  counterpartLng,
  polyline,
  title = 'You',
  counterpartTitle = 'Destination',
}: Props) {
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  const otherLatitude = toNumber(counterpartLat);
  const otherLongitude = toNumber(counterpartLng);

  if (latitude === null || longitude === null) {
    return (
      <View style={[styles.container, styles.fallback]}>
        <Text style={styles.fallbackText}>Location is not available yet.</Text>
      </View>
    );
  }

  const points = (polyline ?? [])
    .map((point) => ({ latitude: toNumber(point[0]), longitude: toNumber(point[1]) }))
    .filter(
      (point): point is { latitude: number; longitude: number } =>
        point.latitude !== null && point.longitude !== null,
    );

  const region = {
    latitude,
    longitude,
    latitudeDelta: otherLatitude !== null ? Math.max(0.01, Math.abs(latitude - otherLatitude) * 1.5) : 0.02,
    longitudeDelta: otherLongitude !== null ? Math.max(0.01, Math.abs(longitude - otherLongitude) * 1.5) : 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView initialRegion={region} style={styles.map} scrollEnabled zoomEnabled>
        <Marker coordinate={{ latitude, longitude }} title={title} />
        {otherLatitude !== null && otherLongitude !== null && (
          <Marker coordinate={{ latitude: otherLatitude, longitude: otherLongitude }} title={counterpartTitle} />
        )}
        {points.length > 1 && <Polyline coordinates={points} strokeColor="#4C6FFF" strokeWidth={4} />}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
