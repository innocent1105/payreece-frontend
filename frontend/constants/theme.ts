/**
 * App theme tokens. Apple-inspired: clean surfaces, translucent glass, restrained color.
 */

import { Platform } from 'react-native';

export const Palette = {
  accent: '#0A84FF',
  accentSoft: '#5AC8FA',
  indigo: '#5E5CE6',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FFD60A',
};

const shared = {
  accent: Palette.accent,
  accentSoft: Palette.accentSoft,
  success: Palette.success,
  danger: Palette.danger,
  warning: Palette.warning,
  overlay: 'rgba(0,0,0,0.4)',
  shadow: '#000000',
};

export const Colors = {
  light: {
    ...shared,
    text: '#1C1C1E',
    textSecondary: '#6C6C70',
    textMuted: '#8E8E93',
    background: '#F2F2F7',
    backgroundAlt: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F2F2F7',
    glass: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.6)',
    glassHighlight: 'rgba(255,255,255,0.9)',
    border: 'rgba(60,60,67,0.12)',
    borderStrong: 'rgba(60,60,67,0.18)',
    tint: Palette.accent,
    icon: '#6C6C70',
    tabIconDefault: '#8E8E93',
    tabIconSelected: Palette.accent,
    heroGradient: ['#1C1C4E', '#2A2A68', '#3A3A8C'],
    heroText: '#FFFFFF',
    heroTextMuted: 'rgba(255,255,255,0.72)',
    inputBg: 'rgba(118,118,128,0.08)',
    inputBorder: 'rgba(60,60,67,0.12)',
    cardShadow: 'rgba(0,0,0,0.08)',
    tabBar: 'rgba(255,255,255,0.78)',
    tabBarBorder: 'rgba(255,255,255,0.7)',
    sheet: '#FFFFFF',
    dangerSoft: 'rgba(255,69,58,0.12)',
    successSoft: 'rgba(48,209,88,0.14)',
    accentSoftBg: 'rgba(10,132,255,0.12)',
  },
  dark: {
    ...shared,
    text: '#F5F5F7',
    textSecondary: '#AEAEB2',
    textMuted: '#8E8E93',
    background: '#000000',
    backgroundAlt: '#1C1C1E',
    surface: '#1C1C1E',
    surfaceElevated: '#2C2C2E',
    surfaceMuted: '#2C2C2E',
    glass: 'rgba(44,44,46,0.72)',
    glassBorder: 'rgba(255,255,255,0.12)',
    glassHighlight: 'rgba(255,255,255,0.18)',
    border: 'rgba(84,84,88,0.45)',
    borderStrong: 'rgba(84,84,88,0.65)',
    tint: '#0A84FF',
    icon: '#AEAEB2',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#0A84FF',
    heroGradient: ['#0A0A14', '#141428', '#1C1C3A'],
    heroText: '#FFFFFF',
    heroTextMuted: 'rgba(255,255,255,0.68)',
    inputBg: 'rgba(118,118,128,0.24)',
    inputBorder: 'rgba(84,84,88,0.55)',
    cardShadow: 'rgba(0,0,0,0.45)',
    tabBar: 'rgba(28,28,30,0.78)',
    tabBarBorder: 'rgba(255,255,255,0.08)',
    sheet: '#1C1C1E',
    dangerSoft: 'rgba(255,69,58,0.18)',
    successSoft: 'rgba(48,209,88,0.18)',
    accentSoftBg: 'rgba(10,132,255,0.18)',
  },
};

export type AppTheme = typeof Colors.light;
export type ThemeName = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Motion = {
  duration: {
    fast: 180,
    base: 280,
    slow: 420,
  },
  easing: {
    out: [0.16, 1, 0.3, 1] as const,
    inOut: [0.65, 0, 0.35, 1] as const,
  },
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};
