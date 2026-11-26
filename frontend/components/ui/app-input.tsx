import React from 'react';
import { StyleSheet, TextInput, View, Text, type TextInputProps } from 'react-native';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

type Props = TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
};

export function AppInput({ label, icon, error, style, ...props }: Props) {
  const t = useAppTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text> : null}
      <View style={[styles.field, { backgroundColor: t.inputBg, borderColor: error ? t.danger : t.inputBorder }]}>
        {icon ? <Ionicons name={icon} size={20} color={t.textMuted} style={styles.icon} /> : null}
        <TextInput
          placeholderTextColor={t.textMuted}
          style={[styles.input, { color: t.text }, style]}
          {...props}
        />
      </View>
      {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  error: { fontSize: 12, marginTop: 6, marginLeft: 2 },
});
