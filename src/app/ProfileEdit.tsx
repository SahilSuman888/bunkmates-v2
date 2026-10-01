// **@** ProfileEdit redesign matching reference UI with dynamic theming, industry-standard UX, and preserved v2 features
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext"; // **@** Dynamic theme hook
import { auth, db, storage } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function EditProfile() {
  const router = useRouter();
  const { user } = useUser();

  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);

  // **@** Comprehensive profile state supporting both new UI fields and preserved v2 fields
  const [data, setData] = useState({
    firstName: user?.displayName?.split(" ")[0] || "",
    lastName: user?.displayName?.split(" ").slice(1).join(" ") || "",
    displayName: user?.displayName || "",
    username: "",
    email: user?.email || "",
    mobile: user?.phoneNumber || "",
    bio: "",
    homeCity: "",
    photoURL: user?.photoURL || "",
  });

  // **@** Dynamic theme integration matching settings page
  let themeMode: "dark" | "light" | "system" = "system";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      themeMode = themeContext.mode;
    }
  } catch (e) {
    // fallback to system
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // **@** Curated color palette matching screenshot with dynamic dark/light support
  const colors = useMemo(() => ({
    bg: isDark ? "#0A0A0C" : "#F4F6F9",
    card: isDark ? "#141418" : "#FFFFFF",
    cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
    inputBg: isDark ? "rgba(255, 255, 255, 0.04)" : "#F3F4F6",
    inputBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "transparent",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#8E95A2" : "#7E8590",
    sectionHeader: isDark ? "#8E95A2" : "#8E8E93",
    greyishWhite: isDark ? "#E2E8F0" : "#4B5563", // **@** Greyish-white color matching icons
    iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
    saveBtnBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
    saveBtnBorder: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
    saveBtnText: isDark ? "#E2E8F0" : "#4B5563",
    cameraBadgeBg: isDark ? "#26282E" : "#E2E8F0",
    iconColor: isDark ? "#E2E8F0" : "#4B5563",
    warningBg: isDark ? "rgba(245, 158, 11, 0.09)" : "#FFF8ED",
    warningBorder: isDark ? "rgba(245, 158, 11, 0.35)" : "#FED7AA",
    warningText: isDark ? "#FCD34D" : "#9A3412",
    warningIcon: isDark ? "#F59E0B" : "#EA580C",
    placeholder: isDark ? "#555860" : "#9CA3AF",
  }), [isDark]);

  // **@** Fetch profile from Firestore with backwards compatibility for split names
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const fData = snap.data();

          // **@** Parse existing fullName into first & last name if not explicitly set
          const rawName = fData.name || user.displayName || "";
          const nameParts = rawName.trim().split(" ");
          const fallbackFirst = nameParts[0] || "";
          const fallbackLast = nameParts.slice(1).join(" ") || "";

          setData({
            firstName: fData.firstName || fallbackFirst,
            lastName: fData.lastName || fallbackLast,
            displayName: fData.displayName || fData.name || user.displayName || "",
            username: fData.username || "",
            email: user.email || fData.email || "",
            mobile: fData.mobile || fData.phone || "",
            bio: fData.bio || "",
            homeCity: fData.homeCity || fData.city || "",
            photoURL: fData.photoURL || user.photoURL || "",
          });
        }
      } catch (e) {
        console.log("Load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // **@** Image picker from photo library
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setData((prev) => ({ ...prev, photoURL: result.assets[0].uri }));
    }
  };

  // **@** Comprehensive save handler updating Firestore & Firebase Auth
  const handleSave = async () => {
    if (!user || saving) return;

    try {
      setSaving(true);

      let finalPhotoURL = data.photoURL;

      // **@** Upload local image to Firebase Storage if newly selected
      if (finalPhotoURL && !finalPhotoURL.startsWith("http")) {
        let blob: Blob | null = null;
        try {
          const resp = await fetch(finalPhotoURL);
          blob = await resp.blob();
        } catch (fetchErr) {
          try {
            blob = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.onload = function () {
                resolve(xhr.response);
              };
              xhr.onerror = function () {
                reject(new TypeError("Network request failed"));
              };
              xhr.responseType = "blob";
              xhr.open("GET", finalPhotoURL, true);
              xhr.send(null);
            });
          } catch (xhrErr) {
            console.log("Upload conversion failed:", fetchErr, xhrErr);
            throw xhrErr || fetchErr;
          }
        }

        if (blob) {
          const storageRef = ref(storage, `profileImages/${user.uid}.jpg`);
          await uploadBytes(storageRef, blob as any);
          finalPhotoURL = await getDownloadURL(storageRef);
        }
      }

      // **@** Build composite full name from first & last name
      const computedName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim() || data.displayName.trim();

      // **@** Persist all fields to Firestore
      await updateDoc(doc(db, "users", user.uid), {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name: computedName,
        displayName: data.displayName.trim(),
        username: data.username.trim(),
        mobile: data.mobile.trim(),
        phone: data.mobile.trim(),
        bio: data.bio.trim(),
        homeCity: data.homeCity.trim(),
        photoURL: finalPhotoURL,
        updatedAt: new Date(),
      });

      // **@** Sync display name and avatar with Firebase Auth
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: data.displayName.trim() || computedName,
          photoURL: finalPhotoURL,
        });
      }

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.log("Save error:", e);
      Alert.alert("Error", e?.message || "Failed to save profile changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !user) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.greyishWhite} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* **@** Top Navigation Header: Exact same modern circular back arrow matching Settings page */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.modernHeaderBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            hitSlop={6}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            Edit Profile
          </Text>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.savePill,
              {
                backgroundColor: colors.saveBtnBg,
                borderColor: colors.saveBtnBorder,
              },
              saving && { opacity: 0.6 },
              pressed && styles.pressed,
            ]}
            hitSlop={6}
            accessibilityLabel="Save profile changes"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.saveBtnText} />
            ) : (
              <Text style={[styles.savePillText, { color: colors.saveBtnText }]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* **@** Avatar Section: Centered photo, camera icon badge at bottom-right, and text link below */}
          <View style={styles.avatarSection}>
            <Pressable onPress={pickImage} style={styles.avatarContainer} accessibilityLabel="Change profile photo">
              <Image
                source={{
                  uri: data.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
                }}
                style={styles.avatar}
              />
              <View style={[styles.cameraBadge, { borderColor: colors.card, backgroundColor: colors.cameraBadgeBg }]}>
                <Ionicons name="camera" size={16} color={colors.greyishWhite} />
              </View>
            </Pressable>

            <Pressable onPress={pickImage} hitSlop={6}>
              <Text style={[styles.changePhotoText, { color: colors.greyishWhite }]}>
                Change Profile Photo
              </Text>
            </Pressable>
          </View>

          {/* **@** Section Header: "PERSONAL INFORMATION" */}
          <Text style={[styles.sectionHeaderTitle, { color: colors.sectionHeader }]}>
            PERSONAL INFORMATION
          </Text>

          {/* **@** Form Container Card: Clean rounded container enclosing all personal fields */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* First Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>First Name</Text>
              <TextInput
                value={data.firstName}
                onChangeText={(v) => setData({ ...data, firstName: v })}
                placeholder="First name"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.textInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
                ]}
              />
            </View>

            {/* Last Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Last Name</Text>
              <TextInput
                value={data.lastName}
                onChangeText={(v) => setData({ ...data, lastName: v })}
                placeholder="Last name"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.textInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
                ]}
              />
            </View>

            {/* Display Name with Subtitle */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Display Name</Text>
              <TextInput
                value={data.displayName}
                onChangeText={(v) => setData({ ...data, displayName: v })}
                placeholder="Display name"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.textInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
                ]}
              />
              <Text style={[styles.fieldHelper, { color: colors.textSecondary }]}>
                This is how other bunkmates will see you on trips.
              </Text>
            </View>

            {/* **@** Preserved v2 feature: Username handle */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Username</Text>
              <View
                style={[
                  styles.inputWithIconWrapper,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <Feather name="at-sign" size={17} color={colors.iconColor} style={styles.inputLeftIcon} />
                <TextInput
                  value={data.username}
                  onChangeText={(v) => setData({ ...data, username: v.toLowerCase().replace(/[^a-z0-9._]/g, "") })}
                  placeholder="username"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  style={[styles.textInputWithIcon, { color: colors.textPrimary }]}
                />
              </View>
            </View>

            {/* Email with Icon (Read-only as in reference) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Email</Text>
              <View
                style={[
                  styles.inputWithIconWrapper,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <Feather name="mail" size={17} color={colors.iconColor} style={styles.inputLeftIcon} />
                <TextInput
                  value={data.email}
                  editable={false}
                  placeholder="Email address"
                  placeholderTextColor={colors.placeholder}
                  style={[styles.textInputWithIcon, { color: colors.textPrimary, opacity: 0.85 }]}
                />
              </View>
            </View>

            {/* Phone with Icon */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Phone</Text>
              <View
                style={[
                  styles.inputWithIconWrapper,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <Feather name="phone" size={17} color={colors.iconColor} style={styles.inputLeftIcon} />
                <TextInput
                  value={data.mobile}
                  onChangeText={(v) => setData({ ...data, mobile: v })}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="phone-pad"
                  style={[styles.textInputWithIcon, { color: colors.textPrimary }]}
                />
              </View>
            </View>

            {/* Bio / Travel Tagline */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Bio / Travel Tagline</Text>
              <TextInput
                value={data.bio}
                onChangeText={(v) => setData({ ...data, bio: v })}
                placeholder="Share your travel vibe, wanderlust tags & hostel stories..."
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
                style={[
                  styles.textAreaInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
                ]}
              />
            </View>

            {/* Home City with Location Pin Icon */}
            <View style={[styles.fieldGroup, { marginBottom: 4 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Home City</Text>
              <View
                style={[
                  styles.inputWithIconWrapper,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <Feather name="map-pin" size={17} color={colors.iconColor} style={styles.inputLeftIcon} />
                <TextInput
                  value={data.homeCity}
                  onChangeText={(v) => setData({ ...data, homeCity: v })}
                  placeholder="e.g. Seattle, WA or Mumbai, India"
                  placeholderTextColor={colors.placeholder}
                  style={[styles.textInputWithIcon, { color: colors.textPrimary }]}
                />
              </View>
            </View>
          </View>

          {/* **@** Bottom Warning Notice matching screenshot with orange/amber styling */}
          <View
            style={[
              styles.warningBanner,
              { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={colors.warningIcon}
              style={styles.warningIcon}
            />
            <Text style={[styles.warningText, { color: colors.warningText }]}>
              Changing your phone number requires quick SMS confirmation on the next step.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
  },

  // **@** Header styling matching screenshot: back arrow, title, and Save pill button
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 6,
    paddingBottom: 10,
    minHeight: 56,
  },
  // **@** Exact same circular button styling as Settings page modernHeaderBtn
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  savePill: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  savePillText: {
    fontSize: 14,
    fontWeight: "600",
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // **@** Avatar section styling
  avatarSection: {
    alignItems: "center",
    marginBottom: 26,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // **@** Section header styling
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // **@** Form card container enclosing all fields
  formCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  fieldHelper: {
    fontSize: 11.5,
    marginTop: 6,
    paddingHorizontal: 2,
  },

  // **@** Standard single-line text input
  textInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
  },

  // **@** Text input with leading icon (Email, Phone, Home City, Username)
  inputWithIconWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  inputLeftIcon: {
    marginRight: 10,
  },
  textInputWithIcon: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 10,
  },

  // **@** Multiline text area input for bio
  textAreaInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    minHeight: 88,
    textAlignVertical: "top",
  },

  // **@** Bottom Warning banner styling matching screenshot
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  warningIcon: {
    marginRight: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
});