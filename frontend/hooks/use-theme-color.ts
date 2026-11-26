import { Colors, type AppTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  if (colorFromProps) return colorFromProps;
  return Colors[theme][colorName];
}

export function useAppTheme(): AppTheme {
  const theme = useColorScheme() ?? 'light';
  return Colors[theme];
}
