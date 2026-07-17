import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeToggle } from "../contexts/ThemeContext";

export default function HelpPage() {
  const router = useRouter();
  const { themeColors } = useThemeToggle();

  const handleEmail = () => {
    const email = "jayendrachoudhary.am@gmail.com";
    Linking.openURL(`mailto:${email}`);
  };

  const openCommunity = () => {
    Linking.openURL("https://example.com/community");
  };

  const openTerms = () => {
    // navigate to terms route if present, otherwise open external placeholder
    try {
      router.push('/terms' as any);
    } catch (e) {
      Linking.openURL('https://example.com/terms');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }] }>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={18} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Support & Help</Text>
      </View>

      <View style={styles.container}>
        <Text style={[styles.intro, { color: themeColors.text }]}>We're here to help you! If you encounter any issues, have questions, or need assistance, please explore the following resources or get in touch with us directly.</Text>

        <Pressable style={[styles.card, { backgroundColor: themeColors.border || '#1f1f1f' }]} onPress={openTerms}>
          <View>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Terms & Conditions</Text>
            <Text style={[styles.cardSubtitle, { color: themeColors.textSecondary }]}>Terms of service and usage policies</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.card, { backgroundColor: themeColors.border || '#1f1f1f' }]} onPress={handleEmail}>
          <View>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>Contact Support</Text>
            <Text style={[styles.cardSubtitle, { color: themeColors.textSecondary }]}>{"Email us at jayendrachoudhary.am@gmail.com"}</Text>
          </View>
        </Pressable>

        <Pressable style={[styles.primaryBtn, { backgroundColor: themeColors.primary }]} onPress={openCommunity}>
          <Text style={styles.primaryBtnText}>Visit Our Community</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  backButton: { marginRight: 12, padding: 6, borderRadius: 20, backgroundColor: 'transparent' },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  container: { paddingHorizontal: 18, paddingTop: 12 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 20, color: '#ccc' },
  card: { padding: 16, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, marginTop: 6 },
  primaryBtn: { marginTop: 10, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
});
