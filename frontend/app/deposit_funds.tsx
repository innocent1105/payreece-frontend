import { BASE_URL } from "@/constants/api";
import { AppButton } from "@/components/ui/app-button";
import { GlassCard } from "@/components/ui/glass-card";
import { ScreenHero } from "@/components/ui/screen-hero";
import { useAppTheme } from "@/hooks/use-theme-color";
import { Radius } from "@/constants/theme";
import axios from "axios";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

export default function DepositFunds() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [error, setError] = useState("");
  const pollRef = useRef<any>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = (reference: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await axios.post(`${BASE_URL}/check_deposit_status.php`, { reference }, { timeout: 10000 });
        if (res.data?.status === "successful" || res.data?.status === "success") {
          clearInterval(pollRef.current); setStatus("success");
        } else if (res.data?.status === "failed" || attempts > 40) {
          clearInterval(pollRef.current); setStatus(attempts > 40 ? "failed" : "failed"); setError("Deposit not confirmed. Please try again.");
        }
      } catch {}
    }, 3000);
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || phone.length < 10) { setError("Enter a valid amount and phone number."); return; }
    setLoading(true); setError(""); setStatus("pending");
    try {
      const res = await axios.post(`${BASE_URL}/deposit_funds.php`, { amount: amt, phone_number: phone }, { timeout: 15000 });
      if (res.data?.success && res.data?.reference) startPolling(res.data.reference);
      else { setStatus("failed"); setError(res.data?.message || "Could not initiate deposit."); }
    } catch { setStatus("failed"); setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  if (status === "success") {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <ScreenHero title="Deposit" onBack={() => router.replace("/(tabs)")} compact />
        <View style={[styles.body, { alignItems: "center", paddingTop: 40 }]}>
          <View style={[styles.successIcon, { backgroundColor: t.successSoft }]}><Ionicons name="checkmark" size={40} color={t.success} /></View>
          <Text style={[styles.successTitle, { color: t.text }]}>Money added</Text>
          <Text style={{ color: t.textSecondary, textAlign: "center", marginBottom: 24 }}>Your deposit of K{amount} was successful.</Text>
          <AppButton label="Done" onPress={() => router.replace("/(tabs)")} style={{ width: "100%" }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <ScreenHero title="Add money" subtitle="Top up with mobile money" onBack={() => router.back()} />
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(380)}>
            <GlassCard>
              <Text style={[styles.label, { color: t.textSecondary }]}>Amount</Text>
              <TextInput style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]} placeholder="0.00" placeholderTextColor={t.textMuted} keyboardType="numeric" value={amount} onChangeText={setAmount} />
              <Text style={[styles.label, { color: t.textSecondary }]}>Mobile money number</Text>
              <TextInput style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]} placeholder="097..." placeholderTextColor={t.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              {error ? <Text style={{ color: t.danger, marginBottom: 12 }}>{error}</Text> : null}
              {status === "pending" ? <Text style={{ color: t.textSecondary, marginBottom: 12, textAlign: "center" }}>Waiting for USSD confirmation…</Text> : null}
              <AppButton label={status === "pending" ? "Waiting for confirmation" : "Add money"} onPress={submit} loading={loading || status === "pending"} />
              <View style={[styles.note, { backgroundColor: t.accentSoftBg }]}><Ionicons name="shield-checkmark-outline" size={16} color={t.tint} /><Text style={{ color: t.textSecondary, fontSize: 13, flex: 1 }}>You’ll receive a prompt on your phone to confirm.</Text></View>
            </GlassCard>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, marginTop: -24 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 52, fontSize: 16, marginBottom: 14 },
  note: { flexDirection: "row", gap: 10, padding: 14, borderRadius: Radius.md, marginTop: 16, alignItems: "center" },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginBottom: 8 },
});
