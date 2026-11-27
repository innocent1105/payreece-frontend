import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  mapOverlay?: boolean;
  collapsedHeightRatio?: number;
  expandedHeightRatio?: number;
};

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
  mapOverlay = false,
  collapsedHeightRatio = 0.154,
  expandedHeightRatio = 0.75,
}: Props) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [slide] = useState(() => new Animated.Value(1));
  const collapsedHeight = Math.round(windowHeight * collapsedHeightRatio);
  const expandedHeight = Math.round(windowHeight * expandedHeightRatio);
  const [expanded, setExpanded] = useState(mapOverlay);
  const [sheetHeight] = useState(() => new Animated.Value(mapOverlay ? expandedHeight : collapsedHeight));

  useEffect(() => {
    if (visible) {
      Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    } else {
      slide.setValue(1);
    }
  }, [visible, slide]);

  const animateTo = useCallback((next: boolean) => {
    const target = next ? expandedHeight : collapsedHeight;
    setExpanded(next);
    Animated.timing(sheetHeight, { toValue: target, duration: 220, useNativeDriver: false }).start();
  }, [collapsedHeight, expandedHeight, sheetHeight]);

  const dragBase = { value: mapOverlay ? expandedHeight : collapsedHeight };
  const currentHeight = () => Number((sheetHeight as any).__getValue());
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => mapOverlay,
    onMoveShouldSetPanResponder: (_, gesture) => mapOverlay && Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => {
      dragBase.value = currentHeight();
    },
    onPanResponderMove: (_, gesture) => {
      const next = Math.max(collapsedHeight, Math.min(expandedHeight, dragBase.value + gesture.dy));
      sheetHeight.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldExpand = gesture.vy < -0.4 || (gesture.vy <= 0.4 && currentHeight() > (collapsedHeight + expandedHeight) / 2);
      animateTo(shouldExpand);
    },
    onPanResponderTerminate: () => animateTo(expanded),
  });

  if (!visible) return null;

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 900],
    extrapolate: 'clamp',
  });

  const content = (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: t.sheet,
          borderColor: t.border,
          paddingTop: mapOverlay ? Math.max(insets.top, 10) : 10,
          paddingBottom: Math.max(insets.bottom, 16),
          maxHeight: mapOverlay ? undefined : '88%',
          height: mapOverlay ? sheetHeight : undefined,
          transform: mapOverlay ? undefined : [{ translateY }],
        },
      ]}
    >
      {mapOverlay ? (
        <View {...panResponder.panHandlers} style={styles.mapHandleArea}>
          <Pressable onPress={() => animateTo(!expanded)} hitSlop={12} style={styles.mapHandleButton}>
            <View style={[styles.handle, styles.mapHandle]} />
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={18} color={t.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.handle} />
      )}
      {title ? (
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          {dismissible ? (
            <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
              <Ionicons name="close" size={20} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={mapOverlay ? styles.overlayContent : undefined}>{children}</View>
    </Animated.View>
  );

  if (mapOverlay) {
    return (
      <View style={[styles.root, styles.overlayRoot]} pointerEvents="box-none">
        {content}
      </View>
    );
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => { if (dismissible) onClose(); }}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => { if (dismissible) onClose(); }} />
        {content}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlayRoot: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(142,142,147,0.45)',
    marginBottom: 14,
  },
  mapHandleArea: { alignItems: 'center', paddingBottom: 8 },
  mapHandleButton: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 4 },
  mapHandle: { marginBottom: 0 },
  overlayContent: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', flex: 1 },
  close: { padding: 4 },
});
