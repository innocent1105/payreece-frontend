import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Radius } from '@/constants/theme';

export const PRIMARY_BLUE = '#0A84FF';

export function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const t = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.cardShadow }]}>
      {title ? <Text style={[styles.cardTitle, { color: t.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function PrimaryButton({
  label, onPress, disabled, tone = 'primary',
}: {
  label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'secondary' | 'danger';
}) {
  const t = useAppTheme();
  const bg = tone === 'primary' ? t.tint : tone === 'danger' ? t.dangerSoft : t.accentSoftBg;
  const fg = tone === 'primary' ? '#fff' : tone === 'danger' ? t.danger : t.tint;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad'; secureTextEntry?: boolean; multiline?: boolean;
}) {
  const t = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
      />
    </View>
  );
}

export function ErrorText({ message }: { message: string }) {
  const t = useAppTheme();
  if (!message) return null;
  return <Text style={[styles.error, { color: t.danger }]}>{message}</Text>;
}

export function InfoText({ children }: { children: React.ReactNode }) {
  const t = useAppTheme();
  return <Text style={[styles.info, { color: t.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, letterSpacing: -0.2 },
  button: { borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { fontWeight: '700', fontSize: 15 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  error: { fontSize: 13, marginBottom: 10 },
  info: { fontSize: 13, lineHeight: 19 },
});
