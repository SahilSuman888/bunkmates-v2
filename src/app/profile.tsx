import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { useUser } from "../contexts/UserContext";
import { auth, db } from "../lib/firebase";

type ProfileData = {
  name?: string;
  username?: string;
  email?: string;
  mobile?: string;
  bio?: string;
  type?: string;
  photoURL?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { width, height } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [feedbackCount, setFeedbackCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  /*
   * Responsive dimensions
   *
   * The original design is approximately based around
   * a 360-400px wide phone.
   */
  const horizontalPadding = Math.max(20, width * 0.055);

  const heroHeight = Math.min(
    Math.max(width * 0.95, 350),
    height * 0.62
  );

  const contentWidth = width - horizontalPadding * 2;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }

    const loadProfile = async () => {
      try {
        /*
         * -----------------------------
         * Load user profile
         * -----------------------------
         */
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setProfile(userSnap.data() as ProfileData);
        } else {
          setProfile({
            name: user.displayName || "User",
            email: user.email || "",
            photoURL: user.photoURL || "",
            type: "Dev Beta",
          });
        }

        /*
         * -----------------------------
         * Feedback count
         * -----------------------------
         */
        try {
          const feedbackQuery = query(
            collection(db, "feedback"),
            where("uid", "==", user.uid)
          );

          const feedbackSnap = await getDocs(feedbackQuery);
          setFeedbackCount(feedbackSnap.size);
        } catch (error) {
          console.log("Feedback count error:", error);
        }

        /*
         * -----------------------------
         * Issue count
         *
         * If your project uses another
         * collection name, change it here.
         * -----------------------------
         */
        try {
          const issuesQuery = query(
            collection(db, "issues"),
            where("uid", "==", user.uid)
          );

          const issuesSnap = await getDocs(issuesQuery);
          setIssueCount(issuesSnap.size);
        } catch (error) {
          // Collection may not exist yet.
          setIssueCount(0);
        }

        /*
         * -----------------------------
         * Report count
         *
         * If your project uses another
         * collection name, change it here.
         * -----------------------------
         */
        try {
          const reportsQuery = query(
            collection(db, "reports"),
            where("uid", "==", user.uid)
          );

          const reportsSnap = await getDocs(reportsQuery);
          setReportCount(reportsSnap.size);
        } catch (error) {
          // Collection may not exist yet.
          setReportCount(0);
        }
      } catch (error) {
        console.log("Profile fetch error:", error);

        setProfile({
          name: user.displayName || "User",
          email: user.email || "",
          photoURL: user.photoURL || "",
          type: "Dev Beta",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authLoading, user]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/(auth)/login" as any);
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  const displayName =
    profile?.name ||
    user?.displayName ||
    "User";

  const username =
    profile?.username ||
    "username";

  const email =
    profile?.email ||
    user?.email ||
    "";

  const mobile =
    profile?.mobile ||
    "Not added";

  const bio =
    profile?.bio ||
    "No bio added";

  const userType =
    profile?.type ||
    "Dev Beta";

  const photoURL =
    profile?.photoURL ||
    user?.photoURL ||
    "https://i.pravatar.cc/600?img=12";

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(35, height * 0.04),
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* =======================================================
            HERO PROFILE AREA
        ======================================================= */}

        <View
          style={[
            styles.hero,
            {
              height: heroHeight,
            },
          ]}
        >
          {/* Profile Image */}

          <Image
            source={{ uri: photoURL }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Dark overall overlay */}

          <LinearGradient
            colors={[
              "rgba(0,0,0,0.18)",
              "rgba(0,0,0,0.05)",
              "rgba(0,0,0,0.15)",
              "rgba(0,0,0,0.96)",
            ]}
            locations={[0, 0.28, 0.58, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Additional bottom darkness */}

          <LinearGradient
            colors={[
              "transparent",
              "rgba(0,0,0,0.35)",
              "rgba(0,0,0,0.92)",
            ]}
            locations={[0, 0.45, 1]}
            style={styles.bottomGradient}
          />

          {/* ===================================================
              TOP BAR
          =================================================== */}

          <SafeAreaView
            edges={["top"]}
            style={styles.heroSafeArea}
          >
            <View style={styles.topBar}>
              {/* Back */}

              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.circleButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color="#ffffff"
                />
              </Pressable>

              {/* User Type */}

              <View style={styles.betaBadge}>
                <Text style={styles.betaBadgeText}>
                  {userType}
                </Text>
              </View>

              {/* Edit */}

              <Pressable
                onPress={() => router.push("/ProfileEdit" as any)}
                style={({ pressed }) => [
                  styles.circleButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="pencil"
                  size={20}
                  color="#ffffff"
                />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* ===================================================
              PROFILE NAME
          =================================================== */}

          <View
            style={[
              styles.profileIdentity,
              {
                bottom: heroHeight * 0.34,
              },
            ]}
          >
            <Text
              style={[
                styles.profileName,
                {
                  fontSize: Math.max(19, width * 0.052),
                },
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>

            <Text style={styles.username}>
              @{username}
            </Text>
          </View>

          {/* ===================================================
              BETA STATISTICS
          =================================================== */}

          <View
            style={[
              styles.statisticsArea,
              {
                bottom: heroHeight * 0.055,
                paddingHorizontal: horizontalPadding,
              },
            ]}
          >
            <View style={styles.statisticsHeader}>
              <View>
                <Text style={styles.statisticsTitle}>
                  Beta Statistics
                </Text>

                <Text style={styles.statisticsSubtitle}>
                  Your testing contribution
                </Text>
              </View>

              <View style={styles.smallBetaBadge}>
                <Text style={styles.smallBetaText}>
                  {userType}
                </Text>
              </View>
            </View>

            {/* Statistics cards */}

            <View style={styles.statisticsRow}>
              <View
                style={[
                  styles.statCard,
                  {
                    width:
                      (contentWidth - 20) / 3,
                  },
                ]}
              >
                <Text style={styles.statNumber}>
                  {feedbackCount}
                </Text>

                <Text style={styles.statLabel}>
                  Feedbacks
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    width:
                      (contentWidth - 20) / 3,
                  },
                ]}
              >
                <Text style={styles.statNumber}>
                  {issueCount}
                </Text>

                <Text style={styles.statLabel}>
                  Issues
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    width:
                      (contentWidth - 20) / 3,
                  },
                ]}
              >
                <Text style={styles.statNumber}>
                  {reportCount}
                </Text>

                <Text style={styles.statLabel}>
                  Reports
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* =======================================================
            USER INFORMATION
        ======================================================= */}

        <View
          style={[
            styles.infoSection,
            {
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          {/* User Type */}

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              User Type
            </Text>

            <Text style={styles.infoValue}>
              {userType}
            </Text>
          </View>

          {/* Email */}

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Email
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={2}
            >
              {email}
            </Text>
          </View>

          {/* Mobile */}

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Mobile
            </Text>

            <Text style={styles.infoValue}>
              {mobile}
            </Text>
          </View>

          {/* Bio */}

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              Bio
            </Text>

            <Text style={styles.infoValue}>
              {bio}
            </Text>
          </View>
        </View>

        {/* =======================================================
            LOGOUT
        ======================================================= */}

        <View
          style={[
            styles.logoutContainer,
            {
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutPressed,
            ]}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color="#ffffff"
            />

            <Text style={styles.logoutText}>
              Logout
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/* ===============================================================
   STYLES
=============================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  scrollView: {
    flex: 1,
    backgroundColor: "#000000",
  },

  scrollContent: {
    backgroundColor: "#000000",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },

  /* =============================================================
     HERO
  ============================================================= */

  hero: {
    width: "100%",
    position: "relative",
    backgroundColor: "#000000",
    overflow: "hidden",
  },

  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },

  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
  },

  heroSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  topBar: {
    width: "100%",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(20,20,20,0.65)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  betaBadge: {
    position: "absolute",
    left: 52,
    right: 52,
    alignItems: "center",
  },

  betaBadgeText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.65,
  },

  /* =============================================================
     IDENTITY
  ============================================================= */

  profileIdentity: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
  },

  profileName: {
    color: "#ffffff",
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },

  username: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    marginTop: 3,
    textAlign: "center",
  },

  /* =============================================================
     STATISTICS
  ============================================================= */

  statisticsArea: {
    position: "absolute",
    left: 0,
    right: 0,
  },

  statisticsHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  statisticsTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  statisticsSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 8.5,
    marginTop: 4,
  },

  smallBetaBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  smallBetaText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 8,
    fontWeight: "600",
  },

  statisticsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  statCard: {
    height: 57,
    minWidth: 0,
    borderRadius: 13,
    backgroundColor: "rgba(15,15,15,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  statNumber: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 18,
  },

  statLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 8.5,
    marginTop: 3,
  },

  /* =============================================================
     INFORMATION
  ============================================================= */

  infoSection: {
    backgroundColor: "#000000",
    paddingTop: 27,
  },

  infoItem: {
    marginBottom: 25,
  },

  infoLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },

  infoValue: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 10.5,
    lineHeight: 16,
  },

  /* =============================================================
     LOGOUT
  ============================================================= */

  logoutContainer: {
    marginTop: 2,
  },

  logoutButton: {
    height: 39,
    borderRadius: 13,
    backgroundColor: "#3b0505",
    borderWidth: 1,
    borderColor: "rgba(255,70,70,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    gap: 12,
  },

  logoutPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.99 }],
  },

  logoutText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
});