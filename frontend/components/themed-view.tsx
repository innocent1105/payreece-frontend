import { View, type ViewProps } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  surface?: 'background' | 'surface' | 'sheet' | 'transparent';
};

export function ThemedView({ style, lightColor, darkColor, surface = 'background', ...otherProps }: ThemedViewProps) {
  const theme = useColorScheme() ?? 'light';
  const tokenBg = surface === 'transparent' ? 'transparent' : Colors[theme][surface];
  const backgroundColor = (theme === 'light' ? lightColor : darkColor) ?? tokenBg;
  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
