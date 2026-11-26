import PaySheet from '@/components/marketplace/PaySheet';
import { router } from 'expo-router';
import React from 'react';

export default function MarketplaceRequest() {
  return <PaySheet visible onClose={() => router.back()} />;
}
