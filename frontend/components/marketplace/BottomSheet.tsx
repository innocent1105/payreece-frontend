import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
};

export default function BottomSheet({ visible, onClose, title, children, dismissible = true }: Props) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    } else {
      slide.setValue(1);
    }
  }, [visible, slide]);

  if (!visible) return null;

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 900],
    extrapolate: 'clamp',
  });

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => { if (dismissible) onClose(); }}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => { if (dismissible) onClose(); }} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: t.sheet,
              borderColor: t.border,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
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
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', flex: 1 },
  close: { padding: 4 },
});
