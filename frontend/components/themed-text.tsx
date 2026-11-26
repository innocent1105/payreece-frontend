import { StyleSheet, Text, type TextProps } from 'react-native';
import { useAppTheme } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'caption';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  const t = useAppTheme();
  const color = lightColor ?? darkColor ?? (type === 'link' ? t.tint : type === 'caption' ? t.textSecondary : t.text);
  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'caption' ? styles.caption : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 24 },
  defaultSemiBold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -0.5 },
  subtitle: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  link: { lineHeight: 24, fontSize: 16, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18 },
});
