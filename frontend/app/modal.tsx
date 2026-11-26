import { GlassCard } from '@/components/ui/glass-card';
import { useAppTheme } from '@/hooks/use-theme-color';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  const t = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <GlassCard>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '700' }}>Modal</Text>
        <Link href="/" dismissTo style={{ marginTop: 12 }}><Text style={{ color: t.tint, fontWeight: '600' }}>Go home</Text></Link>
      </GlassCard>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 } });
