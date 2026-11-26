import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedRef, useAnimatedStyle, useScrollOffset } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-theme-color';

const HEADER_HEIGHT = 260;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor?: { dark: string; light: string };
  headerHeight?: number;
}>;

export default function ParallaxScrollView({ children, headerImage, headerBackgroundColor, headerHeight = HEADER_HEIGHT }: Props) {
  const t = useAppTheme();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollOffset.value, [-headerHeight, 0, headerHeight], [-headerHeight / 2, 0, headerHeight * 0.75]) },
      { scale: interpolate(scrollOffset.value, [-headerHeight, 0, headerHeight], [1.5, 1, 1]) },
    ],
  }));

  const bg = headerBackgroundColor ? headerBackgroundColor[t.background === '#000000' ? 'dark' : 'light'] : t.heroGradient[1];

  return (
    <Animated.ScrollView ref={scrollRef} style={{ backgroundColor: t.background, flex: 1 }} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.header, { height: headerHeight, backgroundColor: bg }, headerAnimatedStyle]}>
        {headerImage}
      </Animated.View>
      <View style={[styles.content, { backgroundColor: t.background }]}>{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { overflow: 'hidden' },
  content: { flex: 1, padding: 20, gap: 16, overflow: 'hidden', marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
});
