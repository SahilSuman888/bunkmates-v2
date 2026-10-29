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
  AppState,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext"; // **@** Dynamic theme hook
import { useLanguage } from "../contexts/LanguageContext";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile, sendEmailVerification } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { SwipeableDrawer } from "./settings/_components/SwipeableDrawer";

export default function EditProfile() {
  const router = useRouter();
  const { user, updateUserData } = useUser();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verifyDrawerVisible, setVerifyDrawerVisible] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    type: "info" | "success" | "warning" | "error";
    message: string;
  } | null>(null);

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
  const {
    mode: themeMode,
    themeColors: dynamicThemeColors,
    accentColor: dynamicAccent,
    onAccentTextColor,
    accent,
    isDark,
    scaleFont,
  } = useThemeToggle();

  const isWhiteAccent =
    accent === "white" ||
    accent === "navWhite" ||
    accent === "#FFFFFF" ||
    accent === "#ffffff" ||
    accent?.toLowerCase() === "#ffffff" ||
    dynamicAccent?.toLowerCase() === "#ffffff";

  const isBrightAccent =
    isWhiteAccent ||
    accent === "yellow" ||
    accent === "sunflower" ||
    dynamicAccent === "#fbc02d" ||
    dynamicAccent === "#ffd700" ||
    dynamicAccent === "#f59e0b";

  // **@** Curated color palette with dynamic white & bright accent contrast support
  const colors = useMemo(() => {
    let saveBtnBg = dynamicAccent || (isDark ? "#FFFFFF" : "#111827");
    let saveBtnText = onAccentTextColor || (isDark ? "#000000" : "#FFFFFF");
    let saveBtnBorder = "transparent";
    let saveBtnBorderWidth = 0;

    if (isWhiteAccent) {
      if (isDark) {
        saveBtnBg = "#FFFFFF";
        saveBtnText = "#000000";
        saveBtnBorder = "transparent";
        saveBtnBorderWidth = 0;
      } else {
        saveBtnBg = "#FFFFFF";
        saveBtnText = "#111827";
        saveBtnBorder = "#111827";
        saveBtnBorderWidth = 1.5;
      }
    } else if (isBrightAccent) {
      saveBtnBg = dynamicAccent;
      saveBtnText = "#000000";
      saveBtnBorder = !isDark ? "rgba(0,0,0,0.15)" : "transparent";
      saveBtnBorderWidth = !isDark ? 1 : 0;
    } else {
      saveBtnBg = dynamicAccent;
      saveBtnText = "#FFFFFF";
      saveBtnBorder = "transparent";
      saveBtnBorderWidth = 0;
    }

    return {
      bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"), // Solid dynamic surface
      cardBorder: "transparent",
      inputBg: isDark ? "#202024" : "#F3F4F6",
      inputBorder: "transparent",
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#8E8E93"),
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      saveBtnBg,
      saveBtnBorder,
      saveBtnBorderWidth,
      saveBtnText,
      cameraBadgeBg: isDark ? "#26282E" : "#E2E8F0",
      iconColor: isDark ? "#E2E8F0" : "#4B5563",
      warningBg: isDark ? "rgba(245, 158, 11, 0.09)" : "#FFF8ED",
      warningBorder: "transparent",
      warningText: isDark ? "#FCD34D" : "#9A3412",
      warningIcon: isDark ? "#F59E0B" : "#EA580C",
      placeholder: isDark ? "#555860" : "#9CA3AF",
      verifiedBg: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.12)",
      verifiedText: "#10B981",
      verifyBtnBg: dynamicThemeColors?.accentBg ?? (isWhiteAccent ? (isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)") : (isDark ? "rgba(255, 90, 95, 0.15)" : "rgba(255, 90, 95, 0.10)")),
      verifyBtnText: dynamicThemeColors?.accentText ?? (isWhiteAccent ? (isDark ? "#FFFFFF" : "#11141A") : dynamicAccent),
    };
  }, [isDark, dynamicThemeColors, dynamicAccent, onAccentTextColor, isWhiteAccent, isBrightAccent]);

  // **@** Fetch profile from Firestore with backwards compatibility for split names
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const fData = snap.data();
          if (fData.emailVerifiedByUser === true) {
            setIsEmailVerified(true);
          }

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

  // **@** Image picker from photo library — encodes as string for direct Firestore persistence
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let photoString = asset.uri;

        if (asset.base64) {
          const mimeType = asset.mimeType || "image/jpeg";
          photoString = `data:${mimeType};base64,${asset.base64}`;
        } else if (asset.uri.startsWith("file://") || asset.uri.startsWith("content://")) {
          try {
            const b64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: "base64",
            });
            photoString = `data:image/jpeg;base64,${b64}`;
          } catch (e) {
            console.log("FileSystem base64 read fallback error:", e);
          }
        }

        setData((prev) => ({ ...prev, photoURL: photoString }));
      }
    } catch (err) {
      console.log("pickImage error:", err);
    }
  };

  // **@** Verification Drawer Handlers & Flow (Zero Alert.alert)
  const handleOpenVerifyDrawer = () => {
    setVerificationFeedback(null);
    setVerifyDrawerVisible(true);
  };

  // Step 2 Action: Send Verification Email
  const handleSendVerificationEmail = async () => {
    if (!auth.currentUser) {
      setVerificationFeedback({
        type: "error",
        message: "No authenticated user session found.",
      });
      return;
    }

    setSendingVerification(true);
    setVerificationFeedback(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationSent(true);
      setVerificationFeedback({
        type: "info",
        message: `Verification link sent to ${data.email || auth.currentUser.email}. Check your inbox and tap the link!`,
      });
    } catch (e: any) {
      console.log("sendEmailVerification error:", e);
      if (e?.code === "auth/too-many-requests") {
        setVerificationFeedback({
          type: "warning",
          message: "Too many requests. Please wait a few moments before requesting another link.",
        });
      } else {
        setVerificationFeedback({
          type: "error",
          message: e?.message || "Failed to send verification email. Please try again.",
        });
      }
    } finally {
      setSendingVerification(false);
    }
  };

  // Step 4 & 5 Action: Reload auth state and update verification badge in Firestore
  const handleCheckVerificationStatus = async () => {
    if (!auth.currentUser) return;

    setCheckingVerification(true);
    setVerificationFeedback(null);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setIsEmailVerified(true);
        setVerificationSent(false);
        setVerificationFeedback({
          type: "success",
          message: "Email verified successfully! Green Verified ✓ badge is now active on your profile.",
        });
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          emailVerifiedByUser: true,
          emailVerified: true,
        }).catch(() => {});
      } else {
        setVerificationFeedback({
          type: "warning",
          message: "Link not verified yet. Please open the email sent to your inbox and tap 'Verify My Email'.",
        });
      }
    } catch (e: any) {
      console.log("Check verification error:", e);
      setVerificationFeedback({
        type: "error",
        message: e?.message || "Failed to check verification status. Please try again.",
      });
    } finally {
      setCheckingVerification(false);
    }
  };

  // Open user's default email app
  const handleOpenMailApp = async () => {
    try {
      const emailUrl = Platform.OS === "ios" ? "message:" : "mailto:";
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        await Linking.openURL(`mailto:${data.email || auth.currentUser?.email || ""}`);
      }
    } catch (err) {
      try {
        await Linking.openURL(`mailto:${data.email || auth.currentUser?.email || ""}`);
      } catch (e) {
        setVerificationFeedback({
          type: "info",
          message: "Please open your email application manually to find the link.",
        });
      }
    }
  };

  // Automatic app resume detection: when user clicks verification link in email app and returns
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active" && !isEmailVerified && auth.currentUser) {
        try {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            setIsEmailVerified(true);
            setVerificationSent(false);
            setVerificationFeedback({
              type: "success",
              message: "Email verified successfully! Green Verified ✓ badge is now active on your profile.",
            });
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
              emailVerifiedByUser: true,
              emailVerified: true,
            }).catch(() => {});
          }
        } catch (e) {
          console.log("AppState verification reload error:", e);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isEmailVerified]);

  // **@** Comprehensive save handler updating Firestore directly with photoURL string (No Firebase Storage)
  const handleSave = async () => {
    if (!user || saving) return;

    try {
      setSaving(true);

      let finalPhotoURL = data.photoURL || "";

      // Ensure any local file URI is converted to base64 string
      if (finalPhotoURL.startsWith("file://") || finalPhotoURL.startsWith("content://")) {
        try {
          const b64 = await FileSystem.readAsStringAsync(finalPhotoURL, {
            encoding: "base64",
          });
          finalPhotoURL = `data:image/jpeg;base64,${b64}`;
        } catch (e) {
          console.log("Base64 string fallback error:", e);
        }
      }

      // **@** Build composite full name from first & last name
      const computedName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim() || data.displayName.trim();

      // **@** Optimistic zero-latency local update across entire app
      updateUserData?.({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name: computedName,
        displayName: data.displayName.trim() || computedName,
        username: data.username.trim(),
        mobile: data.mobile.trim(),
        phone: data.mobile.trim(),
        bio: data.bio.trim(),
        homeCity: data.homeCity.trim(),
        photoURL: finalPhotoURL,
      });

      // **@** Persist all fields to Firestore users/{uid} document directly
      // Schema strictly matches reference: photoURL : string
      await updateDoc(doc(db, "users", user.uid), {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name: computedName,
        displayName: data.displayName.trim() || computedName,
        username: data.username.trim(),
        mobile: data.mobile.trim(),
        phone: data.mobile.trim(),
        bio: data.bio.trim(),
        homeCity: data.homeCity.trim(),
        photoURL: finalPhotoURL, // Saved directly to Firestore as string!
        updatedAt: new Date(),
      });

      // Also safely sync display name with Firebase Auth
      if (auth.currentUser) {
        try {
          const authUpdates: { displayName?: string; photoURL?: string } = {
            displayName: data.displayName.trim() || computedName,
          };
          if (finalPhotoURL.startsWith("http") && finalPhotoURL.length < 2048) {
            authUpdates.photoURL = finalPhotoURL;
          }
          await updateProfile(auth.currentUser, authUpdates);
        } catch (authErr) {
          console.log("Firebase Auth updateProfile non-fatal error:", authErr);
        }
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
        <ActivityIndicator size="large" color={colors.saveBtnBg || colors.textPrimary} />
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
            {t("Edit Profile")}
          </Text>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.savePill,
              {
                backgroundColor: colors.saveBtnBg,
                borderColor: colors.saveBtnBorder,
                borderWidth: colors.saveBtnBorderWidth,
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
              <Text style={[styles.savePillText, { color: colors.saveBtnText, fontSize: scaleFont(14) }]}>
                {t("Save")}
              </Text>
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
            {t("PERSONAL INFORMATION")}
          </Text>

          {/* **@** Form Container Card: Clean rounded container enclosing all personal fields */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* First Name and Last Name in one row */}
            <View style={styles.nameRow}>
              <View style={styles.halfFieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("First Name")}</Text>
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

              <View style={styles.halfFieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("Last Name")}</Text>
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
            </View>

            {/* Display Name with Subtitle */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("Display Name")}</Text>
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
                {t("This is how other bunkmates will see you on trips.")}
              </Text>
            </View>

            {/* **@** Preserved v2 feature: Username handle */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("Username")}</Text>
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

            {/* Email with Icon & Verification Status */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginBottom: 0 }]}>{t("Email")}</Text>
                {isEmailVerified && (
                  <Pressable
                    onPress={handleOpenVerifyDrawer}
                    style={[styles.verifiedPill, { backgroundColor: colors.verifiedBg }]}
                    hitSlop={6}
                  >
                    <Ionicons name="checkmark-circle" size={13} color={colors.verifiedText} style={{ marginRight: 3 }} />
                    <Text style={[styles.verifiedPillText, { color: colors.verifiedText }]}>{t("Verified")}</Text>
                  </Pressable>
                )}
              </View>

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

                {isEmailVerified ? (
                  <Pressable
                    onPress={handleOpenVerifyDrawer}
                    style={styles.verifiedRightBadge}
                    hitSlop={6}
                    accessibilityLabel="Email verified"
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleOpenVerifyDrawer}
                    disabled={checkingVerification || sendingVerification}
                    style={({ pressed }) => [
                      styles.verifyActionBtn,
                      {
                        backgroundColor: verificationSent ? colors.iconBoxBg : colors.verifyBtnBg,
                      },
                      pressed && { opacity: 0.75 },
                    ]}
                    hitSlop={6}
                    accessibilityLabel="Verify email"
                  >
                    {checkingVerification || sendingVerification ? (
                      <ActivityIndicator size="small" color={verificationSent ? colors.textPrimary : colors.verifyBtnText} />
                    ) : (
                      <Text
                        style={[
                          styles.verifyActionBtnText,
                          { color: verificationSent ? colors.textPrimary : colors.verifyBtnText },
                        ]}
                      >
                        {verificationSent ? t("Check Status") : t("Verify")}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            {/* Phone with Icon */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("Phone")}</Text>
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
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("Bio / Travel Tagline")}</Text>
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
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t("Home City")}</Text>
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

      {/* ── EMAIL VERIFICATION SWIPEABLE DRAWER ── */}
      <SwipeableDrawer
        visible={verifyDrawerVisible}
        onClose={() => setVerifyDrawerVisible(false)}
        sheetStyle={[styles.drawerSheet, { backgroundColor: colors.card }]}
        handleColor={isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 0, 0, 0.2)"}
        maxHeight="92%"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.drawerScrollContent}
        >
          {/* Header */}
          <View style={styles.drawerHeaderBox}>
            <View
              style={[
                styles.drawerIconCircle,
                {
                  backgroundColor: isEmailVerified
                    ? "rgba(16, 185, 129, 0.15)"
                    : isDark
                    ? "#222226"
                    : "#EEF2FF",
                },
              ]}
            >
              {isEmailVerified ? (
                <Ionicons name="shield-checkmark" size={32} color="#10B981" />
              ) : (
                <Feather name="mail" size={28} color={dynamicAccent || "#6366F1"} />
              )}
            </View>

            <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>
              {isEmailVerified ? t("Email Verified") : t("Verify Your Email")}
            </Text>
            <Text style={[styles.drawerSubtitle, { color: colors.textSecondary }]}>
              {isEmailVerified
                ? t("Your email is confirmed and your profile is protected.")
                : t("Complete the verification flow to earn your Verified badge and protect your account.")}
            </Text>
          </View>

          {/* User Email Pill Card */}
          <View style={[styles.drawerEmailCard, { backgroundColor: colors.iconBoxBg }]}>
            <View style={styles.drawerEmailLeft}>
              <Feather name="at-sign" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <Text
                style={[styles.drawerEmailText, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {data.email || auth.currentUser?.email || "No email provided"}
              </Text>
            </View>
            <View
              style={[
                styles.drawerStatusBadge,
                {
                  backgroundColor: isEmailVerified
                    ? "rgba(16, 185, 129, 0.16)"
                    : verificationSent
                    ? "rgba(59, 130, 246, 0.16)"
                    : "rgba(245, 158, 11, 0.16)",
                },
              ]}
            >
              <Text
                style={[
                  styles.drawerStatusBadgeText,
                  {
                    color: isEmailVerified
                      ? "#10B981"
                      : verificationSent
                      ? "#3B82F6"
                      : "#F59E0B",
                  },
                ]}
              >
                {isEmailVerified
                  ? t("Verified ✓")
                  : verificationSent
                  ? t("Link Sent")
                  : t("Unverified")}
              </Text>
            </View>
          </View>

          {/* 5-Step Journey Stepper (Matching User Specification) */}
          <View style={[styles.stepperContainer, { backgroundColor: colors.iconBoxBg }]}>
            <Text style={[styles.stepperHeading, { color: colors.textSecondary }]}>
              {t("VERIFICATION PROCESS")}
            </Text>

            {/* Step 1: User Signup */}
            <View style={styles.stepItem}>
              <View style={[styles.stepIndicator, styles.stepCompleted]}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
              <View style={styles.stepItemContent}>
                <Text style={[styles.stepItemTitle, { color: colors.textPrimary }]}>
                  {t("Step 1 — User Signup")}
                </Text>
                <Text style={[styles.stepItemDesc, { color: colors.textSecondary }]}>
                  {t("Account created with email & password")}
                </Text>
              </View>
            </View>
            <View style={[styles.stepLine, { backgroundColor: isDark ? "#2E3036" : "#E2E8F0" }]} />

            {/* Step 2: Send Verification Email */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepIndicator,
                  isEmailVerified || verificationSent
                    ? styles.stepCompleted
                    : [styles.stepActive, { backgroundColor: dynamicAccent || "#6366F1" }],
                ]}
              >
                {isEmailVerified || verificationSent ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={styles.stepNumberText}>2</Text>
                )}
              </View>
              <View style={styles.stepItemContent}>
                <Text style={[styles.stepItemTitle, { color: colors.textPrimary }]}>
                  {t("Step 2 — Send Verification Email")}
                </Text>
                <Text style={[styles.stepItemDesc, { color: colors.textSecondary }]}>
                  {verificationSent
                    ? t("Verification email dispatched to inbox")
                    : t("Tap button below to dispatch verification email")}
                </Text>
              </View>
            </View>
            <View style={[styles.stepLine, { backgroundColor: isDark ? "#2E3036" : "#E2E8F0" }]} />

            {/* Step 3: User Opens Email */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepIndicator,
                  isEmailVerified
                    ? styles.stepCompleted
                    : verificationSent
                    ? [styles.stepActive, { backgroundColor: dynamicAccent || "#6366F1" }]
                    : styles.stepPending,
                ]}
              >
                {isEmailVerified ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumberText, !verificationSent && { color: colors.textSecondary }]}>
                    3
                  </Text>
                )}
              </View>
              <View style={styles.stepItemContent}>
                <Text style={[styles.stepItemTitle, { color: colors.textPrimary }]}>
                  {t("Step 3 — User Opens Email")}
                </Text>
                <Text style={[styles.stepItemDesc, { color: colors.textSecondary }]}>
                  {t("Inbox receives 'Verify My Email' link")}
                </Text>
              </View>
            </View>
            <View style={[styles.stepLine, { backgroundColor: isDark ? "#2E3036" : "#E2E8F0" }]} />

            {/* Step 4: Verify Link */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepIndicator,
                  isEmailVerified
                    ? styles.stepCompleted
                    : verificationSent
                    ? [styles.stepActive, { backgroundColor: dynamicAccent || "#6366F1" }]
                    : styles.stepPending,
                ]}
              >
                {isEmailVerified ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumberText, !verificationSent && { color: colors.textSecondary }]}>
                    4
                  </Text>
                )}
              </View>
              <View style={styles.stepItemContent}>
                <Text style={[styles.stepItemTitle, { color: colors.textPrimary }]}>
                  {t("Step 4 — Verify Link")}
                </Text>
                <Text style={[styles.stepItemDesc, { color: colors.textSecondary }]}>
                  {t("Authentication service confirms link token")}
                </Text>
              </View>
            </View>
            <View style={[styles.stepLine, { backgroundColor: isDark ? "#2E3036" : "#E2E8F0" }]} />

            {/* Step 5: Profile Updated */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepIndicator,
                  isEmailVerified ? styles.stepCompleted : styles.stepPending,
                ]}
              >
                {isEmailVerified ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumberText, { color: colors.textSecondary }]}>5</Text>
                )}
              </View>
              <View style={styles.stepItemContent}>
                <Text style={[styles.stepItemTitle, { color: colors.textPrimary }]}>
                  {t("Step 5 — Profile Updated")}
                </Text>
                <Text style={[styles.stepItemDesc, { color: colors.textSecondary }]}>
                  {isEmailVerified
                    ? t("Profile verified! Green Verified ✓ badge active")
                    : t("Fresh status fetched & Green Verified ✓ badge shown")}
                </Text>
              </View>
            </View>
          </View>

          {/* In-Drawer Feedback Alert / Status Banner */}
          {verificationFeedback && (
            <View
              style={[
                styles.feedbackBox,
                verificationFeedback.type === "success" && styles.feedbackSuccess,
                verificationFeedback.type === "warning" && styles.feedbackWarning,
                verificationFeedback.type === "error" && styles.feedbackError,
                verificationFeedback.type === "info" && styles.feedbackInfo,
              ]}
            >
              <Ionicons
                name={
                  verificationFeedback.type === "success"
                    ? "checkmark-circle"
                    : verificationFeedback.type === "warning"
                    ? "alert-circle"
                    : verificationFeedback.type === "error"
                    ? "close-circle"
                    : "information-circle"
                }
                size={18}
                color={
                  verificationFeedback.type === "success"
                    ? "#10B981"
                    : verificationFeedback.type === "warning"
                    ? "#F59E0B"
                    : verificationFeedback.type === "error"
                    ? "#EF4444"
                    : "#3B82F6"
                }
                style={{ marginRight: 8, marginTop: 1 }}
              />
              <Text
                style={[
                  styles.feedbackText,
                  {
                    color:
                      verificationFeedback.type === "success"
                        ? "#10B981"
                        : verificationFeedback.type === "warning"
                        ? "#F59E0B"
                        : verificationFeedback.type === "error"
                        ? "#EF4444"
                        : "#3B82F6",
                  },
                ]}
              >
                {verificationFeedback.message}
              </Text>
            </View>
          )}

          {/* Action Buttons inside Drawer */}
          <View style={styles.drawerActionsContainer}>
            {isEmailVerified ? (
              <Pressable
                style={[styles.drawerPrimBtn, { backgroundColor: "#10B981" }]}
                onPress={() => setVerifyDrawerVisible(false)}
              >
                <Ionicons name="checkmark-done" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.drawerPrimBtnText}>{t("Done")}</Text>
              </Pressable>
            ) : !verificationSent ? (
              <>
                <Pressable
                  style={[
                    styles.drawerPrimBtn,
                    {
                      backgroundColor: colors.saveBtnBg,
                      borderWidth: colors.saveBtnBorderWidth,
                      borderColor: colors.saveBtnBorder,
                    },
                  ]}
                  onPress={handleSendVerificationEmail}
                  disabled={sendingVerification}
                >
                  {sendingVerification ? (
                    <ActivityIndicator size="small" color={colors.saveBtnText} />
                  ) : (
                    <>
                      <Feather name="send" size={17} color={colors.saveBtnText} style={{ marginRight: 8 }} />
                      <Text style={[styles.drawerPrimBtnText, { color: colors.saveBtnText }]}>
                        {t("Send Verification Email")}
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.drawerSecBtn, { borderColor: isDark ? "#2A2A2E" : "#E2E8F0" }]}
                  onPress={() => setVerifyDrawerVisible(false)}
                >
                  <Text style={[styles.drawerSecBtnText, { color: colors.textPrimary }]}>
                    {t("Cancel")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* When email was already sent */}
                <Pressable
                  style={[
                    styles.drawerPrimBtn,
                    {
                      backgroundColor: colors.saveBtnBg,
                      borderWidth: colors.saveBtnBorderWidth,
                      borderColor: colors.saveBtnBorder,
                    },
                  ]}
                  onPress={handleCheckVerificationStatus}
                  disabled={checkingVerification}
                >
                  {checkingVerification ? (
                    <ActivityIndicator size="small" color={colors.saveBtnText} />
                  ) : (
                    <>
                      <Ionicons name="refresh-circle-outline" size={20} color={colors.saveBtnText} style={{ marginRight: 8 }} />
                      <Text style={[styles.drawerPrimBtnText, { color: colors.saveBtnText }]}>
                        {t("Check Verification Status")}
                      </Text>
                    </>
                  )}
                </Pressable>

                <View style={styles.drawerRowBtns}>
                  <Pressable
                    style={[styles.drawerHalfBtn, { backgroundColor: colors.iconBoxBg }]}
                    onPress={handleOpenMailApp}
                  >
                    <Feather name="mail" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.drawerHalfBtnText, { color: colors.textPrimary }]}>
                      {t("Open Mail App")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.drawerHalfBtn, { backgroundColor: colors.iconBoxBg }]}
                    onPress={handleSendVerificationEmail}
                    disabled={sendingVerification}
                  >
                    {sendingVerification ? (
                      <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                      <>
                        <Feather name="refresh-cw" size={14} color={colors.textPrimary} style={{ marginRight: 6 }} />
                        <Text style={[styles.drawerHalfBtnText, { color: colors.textPrimary }]}>
                          {t("Resend Email")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.drawerSecBtn, { borderColor: isDark ? "#2A2A2E" : "#E2E8F0" }]}
                  onPress={() => setVerifyDrawerVisible(false)}
                >
                  <Text style={[styles.drawerSecBtnText, { color: colors.textPrimary }]}>
                    {t("Cancel")}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </SwipeableDrawer>
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
    borderWidth: 0,
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
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 0,
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
    borderWidth: 0,
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
    borderRadius: 28,
    borderWidth: 0,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 0,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedRightBadge: {
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  halfFieldGroup: {
    flex: 1,
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
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
  },

  // **@** Text input with leading icon (Email, Phone, Home City, Username)
  inputWithIconWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 0,
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
    borderRadius: 16,
    borderWidth: 0,
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
    borderRadius: 20,
    borderWidth: 0,
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

  // Drawer Sheet & Content styles
  drawerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  drawerScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  drawerHeaderBox: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 16,
  },
  drawerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  drawerSubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  drawerEmailCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  drawerEmailLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  drawerEmailText: {
    fontSize: 14,
    fontWeight: "600",
  },
  drawerStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  drawerStatusBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  stepperContainer: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  stepperHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepCompleted: {
    backgroundColor: "#10B981",
  },
  stepActive: {
    backgroundColor: "#6366F1",
  },
  stepPending: {
    backgroundColor: "rgba(128, 128, 128, 0.2)",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stepItemContent: {
    flex: 1,
  },
  stepItemTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    marginBottom: 2,
  },
  stepItemDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  stepLine: {
    width: 2,
    height: 12,
    marginLeft: 12,
    marginVertical: 2,
  },
  feedbackBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  feedbackWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  feedbackError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  feedbackInfo: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  feedbackText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
    fontWeight: "500",
  },
  drawerActionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  drawerPrimBtn: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  drawerPrimBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  drawerSecBtn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerSecBtnText: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  drawerRowBtns: {
    flexDirection: "row",
    gap: 10,
  },
  drawerHalfBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerHalfBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
});