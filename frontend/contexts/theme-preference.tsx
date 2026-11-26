import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  isReady: boolean;
};

const STORAGE_KEY = 'ipay-theme-preference';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value === 'light' || value === 'dark' || value === 'system') {
          setPreferenceState(value);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  };

  const resolvedTheme: ResolvedTheme = preference === 'system' ? (systemScheme ?? 'light') : preference;

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, isReady }),
    [preference, resolvedTheme, isReady]
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }
  return ctx;
}

export function useOptionalThemePreference() {
  return useContext(ThemePreferenceContext);
}
