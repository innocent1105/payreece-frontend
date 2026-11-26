import { useThemePreference } from '@/contexts/theme-preference';

export function useColorScheme() {
  try {
    const { resolvedTheme } = useThemePreference();
    return resolvedTheme;
  } catch {
    return 'light' as const;
  }
}
