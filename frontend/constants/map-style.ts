export const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#1c1c1e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1c1e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a3a3c' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#aeaeb2' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#2c2c2e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2c2c2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3a3a3c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2c2c2e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#aeaeb2' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#3a3a3c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1a2a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a6a7a' }] },
];

export const LIGHT_MAP_STYLE: any[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
];
