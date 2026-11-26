import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AppButton({ label, onPress, disabled, loading, variant = 'primary', style, icon }: Props) {
  const t = useAppTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const colors =
    variant === 'primary' ? t.heroGradient :
    variant === 'danger' ? [t.danger, t.danger] :
    variant === 'secondary' ? [t.surfaceElevated, t.surfaceElevated] :
    ['transparent', 'transparent'];

  const textColor = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : variant === 'secondary' ? t.text : t.tint;
  const borderColor = variant === 'secondary' ? t.border : variant === 'ghost' ? 'transparent' : 'transparent';

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => { scale.value = withTiming(0.985, { duration: 120 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 180 }); }}
      style={[aStyle, style, { opacity: isDisabled ? 0.5 : 1 }]}
    >
      <LinearGradient
        colors={colors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, { borderColor, borderWidth: variant === 'secondary' ? 1 : 0 }]}
      >
        {loading ? <ActivityIndicator color={textColor} /> : icon}
        {!loading && <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
});
