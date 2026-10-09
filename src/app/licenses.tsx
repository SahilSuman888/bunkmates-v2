import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeToggle } from "../contexts/ThemeContext";

const libraries = [
  {
    name: "React.js / React Native",
    functionality: "Core Application UI & Framework",
    license: "MIT License",
  },
  {
    name: "Firebase (Auth, Firestore, Messaging)",
    functionality: "Backend Services, Cloud Messaging, Data Storage",
    license: "Apache License 2.0",
  },
  {
    name: "Material UI (v5)",
    functionality: "UI Components & Design System",
    license: "MIT License",
  },
  {
    name: "OpenWeatherMap API",
    functionality: "Real-Time Weather Data",
    license: "CC BY-SA 4.0",
  },
  {
    name: "Google Fonts",
    functionality: "Typography Fonts",
    license: "SIL Open Font License 1.1",
  },
  {
    name: "Material Icons",
    functionality: "UI Icons / Visual Assets",
    license: "Apache License 2.0",
  },
  {
    name: "framer-motion",
    functionality: "Advanced UI Animations",
    license: "MIT License",
  },
  {
    name: "@fullcalendar/react, daygrid, etc.",
    functionality: "Calendar & Scheduling",
    license: "MIT / Commercial Dual License",
  },
  {
    name: "dayjs / date-fns",
    functionality: "Date & Time Handling",
    license: "MIT License",
  },
  {
    name: "react-easy-crop",
    functionality: "Image Cropping & Manipulation",
    license: "MIT License",
  },
  {
    name: "SimpleWebRTC / PeerJS",
    functionality: "Peer-to-Peer Video/Voice Calls",
    license: "MIT License",
  },
  {
    name: "canvas-confetti",
    functionality: "Celebratory UI Effects",
    license: "ISC License",
  },
  {
    name: "uuid",
    functionality: "Unique Identifier Generation",
    license: "MIT License",
  },
  {
    name: "lucide-react / qrcode.react",
    functionality: "UI Icons & QR Generation",
    license: "ISC License",
  },
];

export default function LicensesScreen() {
  const router = useRouter();
  const { isDark, themeColors, scaleFont } = useThemeToggle();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={["top"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header with Circular Back Button */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: themeColors.card },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color={themeColors.text} />
        </Pressable>

        <Text
          style={[
            styles.headerTitle,
            { color: themeColors.text, fontSize: scaleFont(18) },
          ]}
          numberOfLines={1}
        >
          Licenses & Attributions
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: themeColors.text, fontSize: scaleFont(22) }]}>
          Third-Party{"\n"}Licenses &{"\n"}Attributions
        </Text>

        <Text style={[styles.intro, { color: themeColors.textSecondary, fontSize: scaleFont(12) }]}>
          This page lists all open-source and third-party libraries used in
          BunkMates, along with their license types and attributions. We ensure
          full compliance by including the necessary license text, copyright
          notices, and usage terms for every component.
        </Text>

        {/* LIBRARY OVERVIEW */}
        <Text style={[styles.heading, { color: themeColors.text, fontSize: scaleFont(15) }]}>
          Library Overview
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: themeColors.card }]}>
          {libraries.map((library, index) => (
            <View
              key={library.name}
              style={[
                styles.library,
                index < libraries.length - 1 && [styles.libraryBorder, { borderBottomColor: themeColors.divider }],
              ]}
            >
              <Text style={[styles.libraryName, { color: themeColors.text, fontSize: scaleFont(12) }]}>
                {library.name}
              </Text>
              <Text
                style={[
                  styles.libraryDescription,
                  { color: themeColors.textSecondary, fontSize: scaleFont(11) },
                ]}
              >
                {library.functionality} — {library.license}
              </Text>
            </View>
          ))}
        </View>

        {/* LICENSE INFORMATION */}
        <Text style={[styles.heading, { color: themeColors.text, fontSize: scaleFont(15), marginTop: 24 }]}>
          License Information
        </Text>

        {/* 1. MIT LICENSE */}
        <View style={[styles.cardGroup, { backgroundColor: themeColors.card, padding: 16, marginBottom: 16 }]}>
          <Text style={[styles.licenseTitle, { color: themeColors.text, fontSize: scaleFont(14) }]}>
            1. The MIT License
          </Text>
          <Text style={[styles.body, { color: themeColors.textSecondary, fontSize: scaleFont(11.5) }]}>
            Covers React.js, Material UI, and other core frontend dependencies.
            The MIT License is permissive, allowing reuse, modification, and
            redistribution of code provided the original copyright notice is
            retained.
          </Text>
          <View style={styles.bullets}>
            <Text style={[styles.bullet, { color: themeColors.textSecondary }]}>
              • Permission is granted free of charge to use, modify, publish, and
              distribute the software.
            </Text>
            <Text style={[styles.bullet, { color: themeColors.textSecondary }]}>
              • The software is provided "as is" without warranty of any kind.
            </Text>
            <Text style={[styles.bullet, { color: themeColors.textSecondary }]}>
              • Includes copyrights from Facebook, Inc., Material-UI Team, and
              various contributors.
            </Text>
          </View>
        </View>

        {/* 2. APACHE LICENSE */}
        <View style={[styles.cardGroup, { backgroundColor: themeColors.card, padding: 16, marginBottom: 16 }]}>
          <Text style={[styles.licenseTitle, { color: themeColors.text, fontSize: scaleFont(14) }]}>
            2. Apache License 2.0
          </Text>
          <Text style={[styles.body, { color: themeColors.textSecondary, fontSize: scaleFont(11.5) }]}>
            Applies to Firebase SDKs and Material Icons. This license includes
            explicit patent grants and requires retaining copyright notices.
          </Text>
          <View style={styles.bullets}>
            <Text style={[styles.bullet, { color: themeColors.textSecondary }]}>
              • Grants perpetual, royalty-free copyright and patent licenses.
            </Text>
            <Text style={[styles.bullet, { color: themeColors.textSecondary }]}>
              • Allows modification and distribution in source or object form.
            </Text>
            <Text style={[styles.bullet, { color: themeColors.textSecondary }]}>
              • Applies to Firebase Auth, Firestore, Messaging, and Material
              Icons.
            </Text>
          </View>
        </View>

        {/* 3. CREATIVE COMMONS */}
        <View style={[styles.cardGroup, { backgroundColor: themeColors.card, padding: 16, marginBottom: 16 }]}>
          <Text style={[styles.licenseTitle, { color: themeColors.text, fontSize: scaleFont(14) }]}>
            3. Creative Commons (CC BY-SA 4.0)
          </Text>
          <Text style={[styles.body, { color: themeColors.textSecondary, fontSize: scaleFont(11.5) }]}>
            Applies to data from OpenWeatherMap API and certain map resources.
            Requires attribution and sharing under identical terms.
          </Text>
        </View>

        {/* 4. SIL OPEN FONT LICENSE */}
        <View style={[styles.cardGroup, { backgroundColor: themeColors.card, padding: 16, marginBottom: 16 }]}>
          <Text style={[styles.licenseTitle, { color: themeColors.text, fontSize: scaleFont(14) }]}>
            4. SIL Open Font License 1.1
          </Text>
          <Text style={[styles.body, { color: themeColors.textSecondary, fontSize: scaleFont(11.5) }]}>
            Covers Google Fonts used within the app (Inter, Roboto, etc.). Fonts
            can be bundled, modified, and redistributed freely.
          </Text>
        </View>

        <Text style={[styles.footer, { color: themeColors.textSecondary }]}>
          All trademarks, service marks, and company names are the property of
          their respective owners.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  title: {
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 12,
  },
  intro: {
    lineHeight: 18,
    marginBottom: 20,
  },
  heading: {
    fontWeight: "700",
    marginBottom: 12,
  },
  cardGroup: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 0,
  },
  library: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  libraryBorder: {
    borderBottomWidth: 1,
  },
  libraryName: {
    fontWeight: "700",
  },
  libraryDescription: {
    marginTop: 2,
  },
  licenseTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },
  body: {
    lineHeight: 17,
    marginBottom: 8,
  },
  bullets: {
    gap: 4,
  },
  bullet: {
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    fontSize: 10,
    lineHeight: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 16,
  },
});