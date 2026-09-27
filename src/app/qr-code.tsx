// QR CODE SCREEN - Full-Screen Camera Background with Floating Header, Pill Tabs, Settings Gear & 4 Bold White Corner Brackets

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { BlurView } from "expo-blur";
import Svg, { Path, Rect } from "react-native-svg";

const { width: SCREEN_W } = Dimensions.get("window");
const QR_SIZE = SCREEN_W * 0.68;
const SCAN_BOX_SIZE = Math.min(SCREEN_W * 0.68, 280);

interface QRCodeScreenProps {
  onBack?: () => void;
}

export default function QRCodeScreen({ onBack }: QRCodeScreenProps = {}) {
  const router = useRouter();
  const { user, userData } = useUser();
  const [activeTab, setActiveTab] = useState<"my" | "scan">("scan");

  // Scan state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Scanned user modal state
  const [scannedUserData, setScannedUserData] = useState<any>(null);
  const [showScannedUserModal, setShowScannedUserModal] = useState(false);

  const qrValue = user?.uid ?? "unknown";

  useEffect(() => {
    if (activeTab === "scan" && permission && !permission.granted) {
      requestPermission();
    }
  }, [activeTab, permission]);

  const handleScanSuccess = async (decodedText: string) => {
    if (isProcessing || scanned) return;
    setIsProcessing(true);
    setScanned(true);

    let friendUid = decodedText ? decodedText.trim() : "";

    try {
      const parsed = JSON.parse(friendUid);
      if (parsed && parsed.uid) {
        friendUid = parsed.uid;
      }
    } catch (e) { }

    if (friendUid.includes("bunkmates://profile/")) {
      friendUid = friendUid.replace("bunkmates://profile/", "");
    }
    if (friendUid.includes("bunkmates.com/")) {
      friendUid = friendUid.split("/").pop() || friendUid;
    }

    if (!friendUid || friendUid.length < 5 || friendUid === user?.uid) {
      Alert.alert(
        friendUid === user?.uid ? "Oops!" : "Invalid QR Code",
        friendUid === user?.uid
          ? "You can't add yourself!"
          : "This doesn't look like a valid Bunkmates QR code."
      );
      setIsProcessing(false);
      setScanned(false);
      return;
    }

    try {
      const userDocRef = doc(db, "users", friendUid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        setScannedUserData({ id: docSnap.id, ...docSnap.data() });
        setShowScannedUserModal(true);
      } else {
        Alert.alert("Not Found", "No Bunkmates user found with this QR code.");
        setScanned(false);
      }
    } catch (error) {
      console.error("Error fetching scanned user:", error);
      Alert.alert("Error", "Could not find user. Please try again.");
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddFriend = async () => {
    if (!scannedUserData || !user?.uid) return;
    const friendUid = scannedUserData.id;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        friends: arrayUnion(friendUid),
      });
      await updateDoc(doc(db, "users", friendUid), {
        friends: arrayUnion(user.uid),
      });
      Alert.alert("🎉 Friend Added!", "You are now friends on Bunkmates.");
      setShowScannedUserModal(false);
      setScannedUserData(null);
      setScanned(false);
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("Error", "An error occurred while adding the friend.");
    }
  };

  const displayName =
    userData?.displayName || userData?.name || user?.displayName || "User";
  const username = userData?.username
    ? `@${userData.username}`
    : user?.email ?? "";
  const photoURL = userData?.photoURL || user?.photoURL || null;

  const isAlreadyFriend =
    userData?.friends?.includes(scannedUserData?.id) ?? false;

  return (
    <View style={styles.fullScreenRoot}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* FULL-SCREEN CAMERA FEED BEHIND EVERYTHING WHEN ON SCAN TAB */}
      {activeTab === "scan" && (
        <View style={StyleSheet.absoluteFill}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              active={activeTab === "scan"}
              onBarcodeScanned={
                scanned || isProcessing ? undefined : ({ data }) => handleScanSuccess(data)
              }
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
          ) : (
            <View style={styles.centerPerm}>
              <Feather name="camera-off" size={48} color="#555" />
              <Text style={styles.permText}>Camera permission is required{"\n"}to scan QR codes</Text>
              <Pressable style={styles.permBtn} onPress={requestPermission}>
                <Text style={styles.permBtnText}>Allow Camera</Text>
              </Pressable>
            </View>
          )}

          {/* SVG SINGLE-LAYER TRANSPARENT MASK & CENTERED SCANNING FRAME */}
          <ScannerOverlay scanBoxSize={SCAN_BOX_SIZE} />

          {/* INSTRUCTIONAL TEXT & CONTROLS DYNAMICALLY BELOW FRAME */}
          <View style={styles.belowFrameRow} pointerEvents="box-none">
            <Text style={styles.scanLabel}>Align QR code within the frame</Text>
            {isProcessing && (
              <ActivityIndicator color="#ffffff" style={{ marginTop: 16 }} />
            )}
            {scanned && !isProcessing && (
              <Pressable
                style={styles.retryBtn}
                onPress={() => setScanned(false)}
              >
                <Text style={styles.retryText}>Tap to Scan Again</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* FLOATING TRANSPARENT HEADER & PILL TABS OVERLAY ON TOP OF CAMERA */}
      <SafeAreaView style={styles.floatingTopOverlay} pointerEvents="box-none" edges={["top"]}>
        {/* HEADER ROW */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => (onBack ? onBack() : router.back())}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>QR Code</Text>
        </View>

        {/* PILL-SHAPED SEGMENTED TOGGLE BAR */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === "my" && styles.tabActive]}
            onPress={() => setActiveTab("my")}
          >
            <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>
              My Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "scan" && styles.tabActive]}
            onPress={() => {
              setActiveTab("scan");
              setScanned(false);
            }}
          >
            <Text style={[styles.tabText, activeTab === "scan" && styles.tabTextActive]}>
              Scan Code
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* MY CODE TAB CONTENT (SOLID BLACK CONTAINER, UNCHANGED LAYOUT) */}
      {activeTab === "my" && (
        <View style={styles.myCodeTabContainer}>
          <MyCodeTab
            displayName={displayName}
            username={username}
            photoURL={photoURL}
            qrValue={qrValue}
          />
        </View>
      )}

      {/* SCANNED USER MODAL */}
      <ScannedUserModal
        visible={showScannedUserModal}
        scannedUser={scannedUserData}
        isAlreadyFriend={isAlreadyFriend}
        onAddFriend={handleAddFriend}
        onClose={() => {
          setShowScannedUserModal(false);
          setScannedUserData(null);
          setScanned(false);
        }}
      />
    </View>
  );
}

// --- SCANNER OVERLAY — Single SVG layer with true rounded-rect cutout -------
function ScannerOverlay({ scanBoxSize }: { scanBoxSize: number }) {
  const [layout, setLayout] = useState<{ w: number; h: number } | null>(null);

  const offsetY = 10; // Downward shift below floating top bar
  const r = 30;       // Match border-radius of frame

  const pathData = layout
    ? (() => {
        const W = layout.w;
        const H = layout.h;
        const x = (W - scanBoxSize) / 2;
        const y = (H - scanBoxSize) / 2 + offsetY;
        const s = scanBoxSize;
        const BLEED = 100;

        return [
          `M ${-BLEED} ${-BLEED} H ${W + BLEED * 2} V ${H + BLEED * 2} H ${-BLEED} Z`,
          `M ${x + r} ${y}`,
          `H ${x + s - r}`,
          `A ${r} ${r} 0 0 1 ${x + s} ${y + r}`,
          `V ${y + s - r}`,
          `A ${r} ${r} 0 0 1 ${x + s - r} ${y + s}`,
          `H ${x + r}`,
          `A ${r} ${r} 0 0 1 ${x} ${y + s - r}`,
          `V ${y + r}`,
          `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
          `Z`,
        ].join(" ");
      })()
    : "";

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayout({ w: width, h: height });
        }
      }}
    >
      {layout && (
        <Svg
          // width={layout.w}
          // height={layout.h}
          style={[StyleSheet.absoluteFill, { overflow: "visible" }]}
          pointerEvents="none"
        >
          {/* Full-screen dark overlay with 100px bleed & even-odd cutout */}
          <Path
            d={pathData}
            fill="rgba(0, 0, 0, 0.45)"
            fillRule="evenodd"
          />

          {/* White border frame — locked to exact hole coordinates */}
          <Rect
            x={(layout.w - scanBoxSize) / 2}
            y={(layout.h - scanBoxSize) / 2 + offsetY}
            width={scanBoxSize}
            height={scanBoxSize}
            rx={r}
            ry={r}
            stroke="#ffffff"
            strokeWidth={3.5}
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}

// --- MY CODE TAB (100% ORIGINAL & UNCHANGED) --------------------------------
function MyCodeTab({
  displayName,
  username,
  photoURL,
  qrValue,
}: {
  displayName: string;
  username: string;
  photoURL: string | null;
  qrValue: string;
}) {
  return (
    <View style={styles.myCodeOuter}>
      <View style={styles.myCodeCard}>
        {/* Avatar floating above card */}
        <View style={styles.avatarWrapper}>
          {photoURL ? (
            <Image
              source={{ uri: photoURL }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.nameText}>{displayName}</Text>
        <Text style={styles.usernameText}>{username}</Text>

        <View style={styles.qrWrapper}>
          <QRCode
            value={qrValue}
            size={QR_SIZE}
            color="#000"
            backgroundColor="#fff"
            quietZone={20}
          />
        </View>

        <Text style={styles.hint}>
          Your QR code is private. If you share it, they{"\n"}can add you as a
          friend.
        </Text>
      </View>
    </View>
  );
}

// --- SCANNED USER MODAL ------------------------------------------------------
function ScannedUserModal({
  visible,
  scannedUser,
  isAlreadyFriend,
  onAddFriend,
  onClose,
}: {
  visible: boolean;
  scannedUser: any;
  isAlreadyFriend: boolean;
  onAddFriend: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        {scannedUser && (
          <Pressable style={styles.modalCardOuter} onPress={() => { }}>
            {/* Avatar floating above card */}
            <View style={styles.modalAvatarWrapper}>
              {scannedUser.photoURL ? (
                <Image
                  source={{ uri: scannedUser.photoURL }}
                  style={styles.modalAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.modalAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {(scannedUser.name || scannedUser.displayName || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Card */}
            <View style={styles.modalCard}>
              <Text style={styles.modalName}>
                {scannedUser.name || scannedUser.displayName || "User"}
              </Text>
              <Text style={styles.modalUsername}>
                @{scannedUser.username || "bunkmate"}
              </Text>
              <Text style={styles.modalBio}>
                {scannedUser.bio || "This user hasn't added a bio yet."}
              </Text>

              {/* Action */}
              {isAlreadyFriend ? (
                <View style={styles.alreadyFriendChip}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#4caf50" />
                  <Text style={styles.alreadyFriendText}>Already Friends</Text>
                </View>
              ) : (
                <Pressable style={styles.addFriendBtn} onPress={onAddFriend}>
                  <Text style={styles.addFriendBtnText}>Add Friend</Text>
                </Pressable>
              )}

              <Pressable style={styles.closeModalBtn} onPress={onClose}>
                <Text style={styles.closeModalText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

// --- STYLES -----------------------------------------------------------------
const styles = StyleSheet.create({
  fullScreenRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centerPerm: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 16,
    backgroundColor: "#000000",
  },

  // Floating Top Header & Tabs (Transparent background so live camera shows behind)
  floatingTopOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Pill-shaped Segmented Toggle Bar
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "rgba(35, 35, 35, 0.65)",
    borderRadius: 30,
    padding: 4,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 26,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "rgba(255, 255, 255, 0.22)" },
  tabText: { color: "#cccccc", fontSize: 15, fontWeight: "600" },
  tabTextActive: { color: "#ffffff" },


  // My Code Tab Container (Solid black background, original card layout)
  myCodeTabContainer: {
    flex: 1,
    paddingTop: 190,
    backgroundColor: "#000000",
  },
  myCodeOuter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 46,
  },
  myCodeCard: {
    width: "100%",
    backgroundColor: "#161616",
    borderRadius: 24,
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
    overflow: "visible",
  },
  avatarWrapper: {
    position: "absolute",
    top: -42,
    borderRadius: 40,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarFallback: {
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 32, fontWeight: "700" },
  nameText: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 4 },
  usernameText: { color: "#888", fontSize: 14, marginBottom: 24 },
  qrWrapper: {
    padding: 0,
    borderRadius: 16,
    backgroundColor: "#ffffffff",
    overflow: "hidden",
  },
  hint: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 20,
  },

  // SVG single-layer overlay & below-frame text
  belowFrameRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    marginTop: SCAN_BOX_SIZE / 2 + 30 + 24,
    alignItems: "center",
  },
  scanLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 25,
  },
  retryText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },


  // Permission screen
  permText: {
    color: "#aaa",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: "#ff7a3d",
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 25,
  },
  permBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Scanned User Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  modalCardOuter: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    paddingTop: 44,
  },
  modalAvatarWrapper: {
    position: "absolute",
    top: 0,
    zIndex: 10,
    elevation: 10,
    borderRadius: 44,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  modalAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#f0f0f0",
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  modalName: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  modalUsername: { color: "#888", fontSize: 14, marginBottom: 10 },
  modalBio: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  alreadyFriendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(76,175,80,0.15)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 12,
  },
  alreadyFriendText: { color: "#4caf50", fontWeight: "600", fontSize: 14 },
  addFriendBtn: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  addFriendBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  closeModalBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  closeModalText: { color: "#666", fontSize: 14, fontWeight: "600" },
});
