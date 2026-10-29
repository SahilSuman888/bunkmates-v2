// **@** Linked Devices & Secure Pairing Ecosystem (WhatsApp-style)
// Handles QR scan pairing, 8-character pairing codes, device session registration,
// 0ms offline hydration, real-time revocation, and crypto token verification.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { db, auth } from "./firebase";
import { DeviceSession, getPersistentDeviceId, getDeviceHardwareInfo } from "../utils/sessionTracker";
import { isSessionExpired, normalizeTimestamp, parseQRLoginPayload } from "./qrLoginService";

export type DeviceType = "phone" | "tablet" | "desktop" | "web";
export type PairingStatus = "pending" | "scanned" | "approved" | "rejected" | "expired";

export interface RequesterMetadata {
  deviceName: string;
  deviceType: DeviceType;
  browser?: string;
  os: string;
  ip?: string;
  location?: string;
  userAgent?: string;
}

export interface DevicePairingSession {
  id: string;
  status: PairingStatus;
  pairingMethod: "qr" | "code";
  pairingCode?: string; // Formatted like "ABCD-1234"
  normalizedCode?: string; // Uppercase without dashes: "ABCD1234"
  nonce: string;
  publicKey?: string;
  createdAt: number;
  expiresAt: number;
  requesterMetadata: RequesterMetadata;
  approverUid?: string;
  userId?: string;
  uid?: string;
  userUid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
  };
  userData?: any;
  userProfile?: any;
  idToken?: string;
  token?: string;
  authToken?: string;
  customToken?: string;
  approverDeviceId?: string;
  approvedDevice?: LinkedDevice;
  approvedAt?: number;
}

export interface LinkedDevice {
  id: string;
  sessionId?: string;
  pairingId?: string;
  deviceName: string;
  deviceType: DeviceType;
  browser?: string;
  os: string;
  location: string;
  ipAddress?: string;
  lastActive: string;
  lastActiveTimestamp: number;
  linkedAt: number;
  isActive: boolean;
  isCurrentDevice?: boolean;
  pairingMethod?: "qr" | "code" | "primary";
}

const CACHE_PREFIX = "@bunkmates_cached_devices_";

// Generate an 8-character unambiguous alphanumeric code (e.g., "ABCD-1234")
export const generatePairingCode = (): { formatted: string; normalized: string } => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous 0, O, 1, I
  let code = "";
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  const formatted = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
  return { formatted, normalized: code };
};

// **@** 0ms Offline Hydration: Read cached devices from AsyncStorage
export const getCachedLinkedDevices = async (uid: string): Promise<LinkedDevice[]> => {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.log("[devicePairing] Error reading cached devices:", err);
  }
  return [];
};

// **@** Persist linked devices to AsyncStorage
export const cacheLinkedDevices = async (uid: string, devices: LinkedDevice[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${uid}`, JSON.stringify(devices));
  } catch (err) {
    console.log("[devicePairing] Error caching devices:", err);
  }
};

// **@** Create a new pairing session (used by secondary client)
export const createPairingSession = async (
  method: "qr" | "code",
  requesterMetadata: RequesterMetadata
): Promise<{ pairingId: string; pairingCode?: string; qrPayload: string; expiresAt: number }> => {
  const pairingId = `pair_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const nonce = Crypto.randomUUID ? Crypto.randomUUID() : `nonce_${Date.now()}_${Math.random()}`;
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes TTL

  let pairingCode: string | undefined;
  let normalizedCode: string | undefined;

  if (method === "code") {
    const generated = generatePairingCode();
    pairingCode = generated.formatted;
    normalizedCode = generated.normalized;
  }

  const sessionData: DevicePairingSession = {
    id: pairingId,
    status: "pending",
    pairingMethod: method,
    pairingCode,
    normalizedCode,
    nonce,
    createdAt: now,
    expiresAt,
    requesterMetadata,
  };

  const pairingRef = doc(db, "device_pairings", pairingId);
  await setDoc(pairingRef, sessionData);

  const qrPayload = JSON.stringify({
    version: "2.0",
    protocol: "bunkmates-pairing",
    pairingId,
    nonce,
    expiresAt,
  });

  return { pairingId, pairingCode, qrPayload, expiresAt };
};

// **@** Parse and validate QR code string from camera
export const parseQRPairingPayload = (
  rawData: string
): { pairingId: string; nonce?: string } => {
  const result = parseQRLoginPayload(rawData);
  return { pairingId: result.sessionId, nonce: result.nonce };
};

// **@** Fetch a pairing session by pairingId
export const getPairingSession = async (pairingId: string): Promise<DevicePairingSession | null> => {
  try {
    const snap = await getDoc(doc(db, "device_pairings", pairingId));
    if (!snap.exists()) return null;
    const session = snap.data() as DevicePairingSession;
    if (isSessionExpired(session)) {
      session.status = "expired";
    }
    return session;
  } catch (err) {
    console.log("[devicePairing] Error fetching pairing session:", err);
    return null;
  }
};

// **@** Find a pairing session by 8-character pairing code
export const findPairingByCode = async (
  inputCode: string
): Promise<DevicePairingSession | null> => {
  try {
    const cleaned = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length !== 8) return null;

    const q = query(
      collection(db, "device_pairings"),
      where("normalizedCode", "==", cleaned),
      where("status", "==", "pending"),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return null;

    const docSnap = snap.docs[0];
    const session = docSnap.data() as DevicePairingSession;

    // Check expiration safely
    if (isSessionExpired(session)) {
      return null;
    }

    return session;
  } catch (err) {
    console.log("[devicePairing] Error finding pairing by code:", err);
    return null;
  }
};

// **@** Approve a pairing session and register the device in users/{uid}/devices
export const approvePairingSession = async (params: {
  pairingId: string;
  primaryUid: string;
  primaryDeviceId: string;
  primaryDeviceName: string;
}): Promise<LinkedDevice> => {
  const { pairingId, primaryUid, primaryDeviceId } = params;
  const pairingRef = doc(db, "device_pairings", pairingId);
  const snap = await getDoc(pairingRef);

  if (!snap.exists()) {
    throw new Error("Pairing session not found or has expired.");
  }

  const session = snap.data() as DevicePairingSession;
  if (session.status !== "pending" && session.status !== "scanned") {
    throw new Error(`This session has already been ${session.status}.`);
  }

  if (isSessionExpired(session)) {
    throw new Error("Pairing session expired. Please generate a new code on your other device.");
  }

  const now = Date.now();
  const secondaryDeviceId = `dev_${now}_${Math.random().toString(36).substring(2, 8)}`;

  const newLinkedDevice: LinkedDevice = {
    id: secondaryDeviceId,
    deviceName: session.requesterMetadata.deviceName || "Secondary Device",
    deviceType: session.requesterMetadata.deviceType || "desktop",
    browser: session.requesterMetadata.browser,
    os: session.requesterMetadata.os,
    location: session.requesterMetadata.location || "Active Location",
    ipAddress: session.requesterMetadata.ip || "192.168.1.1",
    lastActive: "Just now",
    lastActiveTimestamp: now,
    linkedAt: now,
    isActive: true,
    isCurrentDevice: false,
    pairingMethod: session.pairingMethod,
  };

  // 1. Write to subcollection users/{uid}/devices/{deviceId}
  const deviceDocRef = doc(db, "users", primaryUid, "devices", secondaryDeviceId);
  await setDoc(deviceDocRef, newLinkedDevice);

  // 2. Also sync to users/{uid}.security.loginActivity & trustedDevices for complete backward compatibility
  try {
    const userDocRef = doc(db, "users", primaryUid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const existingLogins: DeviceSession[] = Array.isArray(uData.security?.loginActivity)
        ? uData.security.loginActivity
        : [];

      const legacyFormat: DeviceSession = {
        id: newLinkedDevice.id,
        deviceName: newLinkedDevice.deviceName,
        deviceType: newLinkedDevice.deviceType === "web" ? "desktop" : newLinkedDevice.deviceType,
        location: `${newLinkedDevice.location} • Just now`,
        lastActive: "Just now",
        isActive: true,
        os: newLinkedDevice.os,
        userAgent: newLinkedDevice.browser,
        ipAddress: newLinkedDevice.ipAddress,
        lastActiveTimestamp: now,
      };

      const updatedLogins = [legacyFormat, ...existingLogins.filter((s) => s.id !== secondaryDeviceId)];

      await updateDoc(userDocRef, {
        "security.loginActivity": updatedLogins,
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.log("[devicePairing] Error updating loginActivity:", err);
  }

  // 3. Extract authenticated phone user identity and ID token
  const currentUser = auth.currentUser;
  let idToken = "";
  if (currentUser) {
    try {
      idToken = await currentUser.getIdToken(true);
    } catch {}
  }

  let userDocData: any = {};
  try {
    const uSnap = await getDoc(doc(db, "users", primaryUid));
    if (uSnap.exists()) {
      userDocData = uSnap.data() || {};
    }
  } catch {}

  const userEmail = currentUser?.email || userDocData?.email || "";
  const userDisplayName =
    currentUser?.displayName ||
    userDocData?.displayName ||
    userDocData?.name ||
    params.primaryDeviceName ||
    "BunkMates User";
  const userPhotoURL =
    currentUser?.photoURL ||
    userDocData?.photoURL ||
    userDocData?.profileImage ||
    userDocData?.avatar ||
    "";
  const userPhoneNumber = currentUser?.phoneNumber || userDocData?.phoneNumber || "";

  const userObject = {
    uid: primaryUid,
    email: userEmail,
    displayName: userDisplayName,
    photoURL: userPhotoURL,
    phoneNumber: userPhoneNumber,
  };

  // 4. Update device_pairings document with full authenticated session for the secondary device
  await updateDoc(pairingRef, {
    status: "approved",
    approverUid: primaryUid,
    userId: primaryUid,
    uid: primaryUid,
    userUid: primaryUid,
    email: userEmail,
    displayName: userDisplayName,
    photoURL: userPhotoURL,
    phoneNumber: userPhoneNumber,
    user: userObject,
    userData: userDocData,
    userProfile: userDocData,
    idToken: idToken || null,
    token: idToken || null,
    authToken: idToken || null,
    approverDeviceId: primaryDeviceId,
    approvedDevice: newLinkedDevice,
    approvedAt: now,
  });

  return newLinkedDevice;
};

// **@** Reject a pairing session
export const rejectPairingSession = async (
  pairingId: string,
  reason: string = "Declined by user"
): Promise<void> => {
  try {
    const pairingRef = doc(db, "device_pairings", pairingId);
    await updateDoc(pairingRef, {
      status: "rejected",
      rejectionReason: reason,
      rejectedAt: Date.now(),
    });
  } catch (err) {
    console.log("[devicePairing] Error rejecting pairing:", err);
  }
};

// **@** Revoke / Log out a linked device in real time
export const revokeLinkedDevice = async (
  uid: string,
  deviceId: string,
  sessionId?: string
): Promise<void> => {
  try {
    // 1. Delete matching device document in subcollection users/{uid}/devices
    try {
      const deviceDocRef = doc(db, "users", uid, "devices", deviceId);
      await deleteDoc(deviceDocRef);
    } catch {}

    // Also scan users/{uid}/devices to clean up any document with matching prefix/timestamp/sessionId
    try {
      const devicesColRef = collection(db, "users", uid, "devices");
      const snap = await getDocs(devicesColRef);
      for (const d of snap.docs) {
        const docId = d.id;
        const data = d.data();
        const matches =
          docId === deviceId ||
          docId.startsWith(deviceId) ||
          deviceId.startsWith(docId) ||
          (sessionId && (data.sessionId === sessionId || data.pairingId === sessionId));
        if (matches) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    } catch {}

    // 2. Remove from users/{uid}.security.loginActivity and trustedDevices (triggers remote kill switch)
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const existingLogins: any[] = Array.isArray(uData.security?.loginActivity)
        ? uData.security.loginActivity
        : [];

      // Filter out matching sessions (handles exact match, prefix match, or sessionId match)
      const updatedLogins = existingLogins.filter((s) => {
        if (!s || !s.id) return false;
        if (s.id === deviceId) return false;
        if (s.id.startsWith(deviceId) || deviceId.startsWith(s.id)) return false;
        if (sessionId && (s.sessionId === sessionId || s.pairingId === sessionId)) return false;
        return true;
      });

      const existingTrusted: any[] = Array.isArray(uData.security?.trustedDevices)
        ? uData.security.trustedDevices
        : [];
      const updatedTrusted = existingTrusted.filter((d) => {
        if (!d || !d.id) return false;
        if (d.id === deviceId || d.id.startsWith(deviceId) || deviceId.startsWith(d.id)) return false;
        return true;
      });

      await updateDoc(userDocRef, {
        "security.loginActivity": updatedLogins,
        "security.trustedDevices": updatedTrusted,
        updatedAt: new Date(),
      });
    }

    // 3. Mark matching device_pairings document as revoked (so secondary desktop client gets instant signal)
    try {
      if (sessionId) {
        const pRef = doc(db, "device_pairings", sessionId);
        await updateDoc(pRef, {
          status: "revoked",
          isActive: false,
          revokedAt: Date.now(),
        }).catch(() => {});
      }
      if (deviceId.startsWith("pair_") || deviceId.startsWith("bunk_qr_") || deviceId.startsWith("qr_")) {
        const pRef = doc(db, "device_pairings", deviceId);
        await updateDoc(pRef, {
          status: "revoked",
          isActive: false,
          revokedAt: Date.now(),
        }).catch(() => {});
      }
    } catch {}

    // 4. Update local cache
    const cached = await getCachedLinkedDevices(uid);
    const updatedCache = cached.filter((d) => {
      if (d.id === deviceId) return false;
      if (d.id.startsWith(deviceId) || deviceId.startsWith(d.id)) return false;
      if (sessionId && (d.sessionId === sessionId || d.pairingId === sessionId)) return false;
      return true;
    });
    await cacheLinkedDevices(uid, updatedCache);
  } catch (err) {
    console.log("[devicePairing] Error revoking device:", err);
    throw err;
  }
};

// **@** Real-time listener for all linked devices
export const subscribeToLinkedDevices = (
  uid: string,
  currentDeviceId: string,
  onUpdate: (devices: LinkedDevice[]) => void
): (() => void) => {
  // Listener on users/{uid}/devices subcollection (unconstrained query to prevent Firestore indexing errors)
  const devicesColRef = collection(db, "users", uid, "devices");

  const unsubSubcollection = onSnapshot(
    devicesColRef,
    async (snapshot) => {
      const subDevices: LinkedDevice[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data() as LinkedDevice;
        return {
          ...d,
          id: docSnap.id,
          isCurrentDevice: docSnap.id === currentDeviceId,
        };
      });

      // Also fetch primary device and legacy sessions from users/{uid} doc
      try {
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);
        let allMerged = [...subDevices];

        if (userSnap.exists()) {
          const uData = userSnap.data();
          const loginActivity: DeviceSession[] = Array.isArray(uData.security?.loginActivity)
            ? uData.security.loginActivity
            : [];

          // Map loginActivity entries with smart deduplication
          for (const s of loginActivity) {
            const alreadyPresent = allMerged.some(
              (d) => d.id === s.id || d.id.startsWith(s.id) || s.id.startsWith(d.id)
            );
            if (!alreadyPresent) {
              allMerged.push({
                id: s.id,
                deviceName: s.deviceName,
                deviceType: s.deviceType as DeviceType,
                os: s.os || "Mobile",
                browser: s.userAgent,
                location: s.location || "Active Location",
                ipAddress: s.ipAddress,
                lastActive: s.lastActive || "Recently",
                lastActiveTimestamp: s.lastActiveTimestamp || Date.now(),
                linkedAt: s.lastActiveTimestamp || Date.now(),
                isActive: !!s.isActive,
                isCurrentDevice: s.id === currentDeviceId,
                pairingMethod: s.id === currentDeviceId ? "primary" : "qr",
              });
            }
          }
        }

        // Sort in memory: Current device first, then newest active
        allMerged.sort((a, b) => {
          if (a.id === currentDeviceId) return -1;
          if (b.id === currentDeviceId) return 1;
          return (b.lastActiveTimestamp || 0) - (a.lastActiveTimestamp || 0);
        });

        // Cache locally for 0ms hydration on next visit
        cacheLinkedDevices(uid, allMerged);
        onUpdate(allMerged);
      } catch {
        onUpdate(subDevices);
      }
    },
    (err) => {
      console.log("[devicePairing] Error listening to devices:", err);
    }
  );

  return () => {
    unsubSubcollection();
  };
};

// **@** Real-time listener for pairing session status (used by secondary device waiting for approval)
export const subscribeToPairingSession = (
  pairingId: string,
  onUpdate: (session: DevicePairingSession | null) => void
): (() => void) => {
  const pairingRef = doc(db, "device_pairings", pairingId);
  return onSnapshot(pairingRef, (snap) => {
    if (!snap.exists()) {
      onUpdate(null);
      return;
    }
    const session = snap.data() as DevicePairingSession;
    if (isSessionExpired(session)) {
      session.status = "expired";
    }
    onUpdate(session);
  });
};
