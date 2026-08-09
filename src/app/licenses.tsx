import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";

const libraries = [
  {
    name: "React.js / React Native",
    functionality: "Core Application UI & Framework",
    license: "MIT License",
  },
  {
    name: "Firebase (Auth, Firestore, Messaging)",
    functionality:
      "Backend Services, Cloud Messaging, Data Storage",
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
    functionality: "Client-Side Image Cropping",
    license: "MIT License",
  },
  {
    name: "react-webcam",
    functionality: "Camera Access & Streaming",
    license: "MIT License",
  },
  {
    name: "jsqr",
    functionality: "QR Code Scanning",
    license: "MIT License",
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
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ================================= */}
        {/* BACK */}
        {/* ================================= */}

        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={15} color="#999" />

          <Text style={styles.backText}>
            BACK
          </Text>
        </Pressable>

        {/* ================================= */}
        {/* TITLE */}
        {/* ================================= */}

        <Text style={styles.title}>
          Third-Party{"\n"}
          Licenses &{"\n"}
          Attributions
        </Text>

        {/* ================================= */}
        {/* INTRO */}
        {/* ================================= */}

        <Text style={styles.intro}>
          This page lists all open-source and third-party
          libraries used in BunkMates, along with their
          license types and attributions. We ensure full
          compliance by including the necessary license
          text, copyright notices, and usage terms for
          every component.
        </Text>

        {/* ================================= */}
        {/* LIBRARY OVERVIEW */}
        {/* ================================= */}

        <Text style={styles.heading}>
          Library Overview
        </Text>

        {libraries.map((library) => (
          <View
            key={library.name}
            style={styles.library}
          >
            <Text style={styles.libraryName}>
              {library.name}
            </Text>

            <Text
              style={styles.libraryDescription}
            >
              {library.functionality} —{" "}
              {library.license}
            </Text>
          </View>
        ))}

        {/* ================================= */}
        {/* DIVIDER */}
        {/* ================================= */}

        <View style={styles.divider} />

        {/* ================================= */}
        {/* LICENSE INFORMATION */}
        {/* ================================= */}

        <Text style={styles.heading}>
          License Information
        </Text>

        {/* ================================= */}
        {/* 1. MIT LICENSE */}
        {/* ================================= */}

        <View style={styles.licenseSection}>
          <Text style={styles.licenseTitle}>
            1. The MIT License
          </Text>

          <Text style={styles.body}>
            Covers React.js, Material UI, and other
            core frontend dependencies. The MIT
            License is permissive, allowing reuse,
            modification, and redistribution of code
            provided the original copyright notice is
            retained.
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>
              • Permission is granted free of charge
              to use, modify, publish, and distribute
              the software.
            </Text>

            <Text style={styles.bullet}>
              • The software is provided "as is"
              without warranty of any kind.
            </Text>

            <Text style={styles.bullet}>
              • Includes copyrights from Facebook,
              Inc., Material-UI Team, and various
              contributors.
            </Text>
          </View>
        </View>

        {/* ================================= */}
        {/* 2. APACHE LICENSE */}
        {/* ================================= */}

        <View style={styles.licenseSection}>
          <Text style={styles.licenseTitle}>
            2. Apache License 2.0
          </Text>

          <Text style={styles.body}>
            Applies to Firebase SDKs and Material
            Icons. This license includes explicit
            patent grants and requires retaining
            copyright notices.
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>
              • Grants perpetual, royalty-free
              copyright and patent licenses.
            </Text>

            <Text style={styles.bullet}>
              • Allows modification and distribution
              in source or object form.
            </Text>

            <Text style={styles.bullet}>
              • Applies to Firebase Auth, Firestore,
              Messaging, and Material Icons.
            </Text>
          </View>
        </View>

        {/* ================================= */}
        {/* 3. CREATIVE COMMONS */}
        {/* ================================= */}

        <View style={styles.licenseSection}>
          <Text style={styles.licenseTitle}>
            3. Creative Commons Attribution-
            ShareAlike 4.0 (CC BY-SA 4.0)
          </Text>

          <Text style={styles.body}>
            Used for OpenWeatherMap API data. Allows
            adaptation and commercial use provided
            attribution and same-license sharing.
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>
              • Attribution required — include credit
              and link to license.
            </Text>

            <Text style={styles.bullet}>
              • Required credit: "Weather Data
              provided by OpenWeatherMap, licensed
              under CC BY-SA 4.0."
            </Text>
          </View>
        </View>

        {/* ================================= */}
        {/* 4. SIL OPEN FONT LICENSE */}
        {/* ================================= */}

        <View style={styles.licenseSection}>
          <Text style={styles.licenseTitle}>
            4. SIL Open Font License 1.1
          </Text>

          <Text style={styles.body}>
            Covers Google Fonts used in the app's
            typography. Allows free use, modification,
            and bundling of font software.
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>
              • Fonts cannot be sold standalone.
            </Text>

            <Text style={styles.bullet}>
              • Modified font names must differ from
              reserved names.
            </Text>

            <Text style={styles.bullet}>
              • Full OFL text is included in font
              metadata.
            </Text>
          </View>
        </View>

        {/* ================================= */}
        {/* 5. FULLCALENDAR */}
        {/* ================================= */}

        <View style={styles.licenseSection}>
          <Text style={styles.licenseTitle}>
            5. FullCalendar Dual License
          </Text>

          <Text style={styles.body}>
            FullCalendar components operate under MIT
            or a Commercial License. Commercial use
            of advanced features may require a paid
            license.
          </Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>
              • BunkMates complies with either MIT or
              commercial terms as required.
            </Text>

            <Text style={styles.bullet}>
              • Copyright © 2025 Adam Shaw.
            </Text>
          </View>
        </View>

        {/* ================================= */}
        {/* END OF STATEMENT */}
        {/* ================================= */}

        <Text style={styles.footer}>
          End of Statement — © 2026 BunkMates. All
          rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  content: {
    paddingHorizontal: 21,
    paddingTop: 28,
    paddingBottom: 35,
  },

  // ==========================================
  // BACK
  // ==========================================

  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#111111",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 18,
    marginBottom: 28,
  },

  backText: {
    color: "#999999",
    fontSize: 10,
    fontWeight: "500",
  },

  // ==========================================
  // TITLE
  // ==========================================

  title: {
    color: "#ffffff",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "800",
    marginBottom: 22,
  },

  // ==========================================
  // INTRO
  // ==========================================

  intro: {
    color: "#d0d0d0",
    fontSize: 10.5,
    lineHeight: 18,
    marginBottom: 25,
  },

  // ==========================================
  // LIBRARY OVERVIEW
  // ==========================================

  heading: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 11,
  },

  library: {
    marginBottom: 9,
  },

  libraryName: {
    color: "#f2f2f2",
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: "700",
  },

  libraryDescription: {
    color: "#a5a5a5",
    fontSize: 9.2,
    lineHeight: 14,
    marginLeft: 10,
  },

  divider: {
    height: 1,
    backgroundColor: "#1c1c1c",
    marginTop: 13,
    marginBottom: 20,
  },

  // ==========================================
  // LICENSE SECTIONS
  // ==========================================

  licenseSection: {
    marginBottom: 25,
  },

  licenseTitle: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    marginBottom: 11,
  },

  body: {
    color: "#d0d0d0",
    fontSize: 10.5,
    lineHeight: 18,
    marginBottom: 8,
  },

  bullets: {
    marginTop: 2,
  },

  bullet: {
    color: "#bdbdbd",
    fontSize: 9.5,
    lineHeight: 15,
    marginBottom: 4,
    paddingLeft: 3,
  },

  // ==========================================
  // FOOTER
  // ==========================================

  footer: {
    color: "#777777",
    fontSize: 9,
    lineHeight: 15,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 5,
  },

  pressed: {
    opacity: 0.65,
  },
});