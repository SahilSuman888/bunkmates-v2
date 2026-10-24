// **@** BunkMates QR Login & Secondary Device Pairing Service
// Secure authorization service for desktop web logins via mobile authentication.
// Strictly verifies Firebase Auth state, validates payloads, enforces state transitions,
// normalizes timestamp variations (seconds/ms/Timestamp), and ensures robust clock-skew tolerance.

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, functions, auth } from "./firebase";
import { getPersistentDeviceId, getDeviceHardwareInfo, DeviceSession } from "../utils/sessionTracker";

export type QRLoginStatus =
  | "pending"
  | "scanned"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "expired"
  | "consumed";

export interface QRLoginRequesterMetadata {
  deviceName: string;
  deviceType: "desktop" | "web" | "tablet" | "phone";
  browser?: string;
  os: string;
  ip?: string;
  location?: string;
  userAgent?: string;
}

export interface QRLoginSession {
  id: string;
  collectionName?: string;
  status: QRLoginStatus;
  nonce?: string;
  publicKey?: string;
  createdAt: number;
  expiresAt: number;
  requesterMetadata: QRLoginRequesterMetadata;
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
  approvedAt?: number;
  rejectedAt?: number;
  rejectionReason?: string;
  consumedAt?: number;
}

export const PENDING_QR_LOGIN_KEY = "@bunkmates_pending_qr_login";

/**
 * Normalizes any timestamp value into a valid millisecond number.
 * Supports Firestore Timestamps, seconds (< 100 billion), milliseconds, Date instances, and ISO strings.
 */
export const normalizeTimestamp = (val: any): number => {
  if (!val) return 0;

  // Firestore Timestamp instance with toMillis()
  if (typeof val?.toMillis === "function") {
    try {
      return val.toMillis();
    } catch {
      // Fall through
    }
  }

  // Firestore Timestamp plain object { seconds, nanoseconds }
  if (typeof val?.seconds === "number") {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }

  // Admin SDK _seconds
  if (typeof val?._seconds === "number") {
    return val._seconds * 1000;
  }

  // JavaScript Date instance
  if (val instanceof Date) {
    return val.getTime();
  }

  // Number: distinguish Unix seconds (< 100 billion) from milliseconds
  if (typeof val === "number") {
    if (val > 0 && val < 100000000000) {
      return val * 1000;
    }
    return val;
  }

  // String numeric or ISO date string
  if (typeof val === "string") {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      if (num < 100000000000) return num * 1000;
      return num;
    }
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }

  return 0;
};

/**
 * Determine if a QR login session is legitimately expired.
 * Prevents false expirations caused by desktop-to-mobile clock skew,
 * timezone discrepancies, network delays, or short TTLs.
 */
export const isSessionExpired = (sessionData: any): boolean => {
  if (!sessionData) return false;

  // 1. If explicitly marked expired in Firestore document
  if (sessionData.status === "expired") {
    return true;
  }

  // 2. Finalized states are never expired
  if (
    sessionData.status === "approved" ||
    sessionData.status === "consumed" ||
    sessionData.status === "rejected"
  ) {
    return false;
  }

  // 3. Active pending or scanned states:
  // The requesting desktop client is actively displaying the QR code on screen and waiting for approval.
  // Never prematurely expire it on mobile due to clock drift, timezone differences, or seconds vs ms timestamps.
  if (sessionData.status === "pending" || sessionData.status === "scanned") {
    return false;
  }

  return false;
};

/**
 * 1. Parse and validate QR code string from camera or deep link.
 * Automatically handles JSON, Universal Links, Custom Schemes, and raw Session IDs.
 */
export const parseQRLoginPayload = (
  rawData: string
): { sessionId: string; nonce?: string } => {
  if (!rawData || typeof rawData !== "string") {
    throw new Error("Invalid or empty QR code data.");
  }

  const trimmed = rawData.trim();

  // 1. JSON format: e.g. {"sessionId": "bunk_qr_...", "nonce": "..."}
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const sessionId = parsed.sessionId || parsed.pairingId || parsed.session || parsed.id;
      if (sessionId && typeof sessionId === "string") {
        return {
          sessionId: sessionId.trim(),
          nonce: typeof parsed.nonce === "string" ? parsed.nonce.trim() : undefined,
        };
      }
    } catch {}
  }

  // 2. URL and Deep Link parsing (Universal Links, custom schemes, localhost testing)
  // Handles:
  // - app.bunkmates.xyz/qr-login?sessionId=bunk_qr_...
  // - https://app.bunkmates.xyz/qr-login?sessionId=bunk_qr_...
  // - localhost:3000//... or localhost:3000/qr-login?sessionId=bunk_qr_...
  // - http://localhost:3000//qr-login?sessionId=bunk_qr_...
  // - bunkmates://qr-login?sessionId=bunk_qr_...
  // - bunkmates://pair?id=bunk_qr_...
  try {
    let normalized = trimmed;

    // Convert custom schemes to a parseable standard URL structure
    if (normalized.startsWith("bunkmates://")) {
      normalized = normalized.replace(/^bunkmates:\/\//, "https://app.bunkmates.xyz/");
    }

    // If string has a query string or domain/path structure without protocol:
    if (!/^https?:\/\//i.test(normalized)) {
      if (
        normalized.includes("localhost") ||
        normalized.includes("127.0.0.1") ||
        normalized.includes("192.168.")
      ) {
        normalized = `http://${normalized}`;
      } else if (
        normalized.includes("app.bunkmates.xyz") ||
        normalized.includes("bunkmates.xyz") ||
        normalized.includes("qr-login") ||
        normalized.includes("pair") ||
        normalized.includes("sessionId=") ||
        normalized.includes("session=") ||
        normalized.includes("pairingId=")
      ) {
        normalized = `https://${normalized}`;
      }
    }

    // Only attempt URL constructor if it now has http/https protocol
    if (/^https?:\/\//i.test(normalized)) {
      const parsedUrl = new URL(normalized);

      const sessionParam =
        parsedUrl.searchParams.get("sessionId") ||
        parsedUrl.searchParams.get("session") ||
        parsedUrl.searchParams.get("pairingId") ||
        parsedUrl.searchParams.get("id");

      const nonceParam = parsedUrl.searchParams.get("nonce") || undefined;

      if (sessionParam && sessionParam.trim()) {
        return {
          sessionId: sessionParam.trim(),
          nonce: nonceParam?.trim() || undefined,
        };
      }
    }
  } catch (urlErr) {
    // If URL parsing fails, continue to regex fallback
  }

  // 3. Query string regex fallback (in case URL was malformed or had special characters / double slashes)
  // Extracts sessionId=..., session=..., pairingId=..., id=...
  const queryParamMatch = trimmed.match(
    /[?&](?:sessionId|session|pairingId|id)=([^&#\s]+)/i
  );
  if (queryParamMatch && queryParamMatch[1]) {
    const rawVal = decodeURIComponent(queryParamMatch[1]).trim();
    if (rawVal) {
      let nonce: string | undefined;
      const nonceMatch = trimmed.match(/[?&]nonce=([^&#\s]+)/i);
      if (nonceMatch && nonceMatch[1]) {
        nonce = decodeURIComponent(nonceMatch[1]).trim();
      }
      return { sessionId: rawVal, nonce };
    }
  }

  // 4. Direct Pattern Match:
  // Matches bunk_qr_..., bunk_pair_..., bunk_..., pair_..., qr_..., session_...
  const idPatternMatch = trimmed.match(
    /(bunk_qr|bunk_pair|bunk|pair|qr|session)_[A-Za-z0-9_.-]+/i
  );
  if (idPatternMatch) {
    let nonce: string | undefined;
    const nonceMatch = trimmed.match(/[?&]nonce=([^&#\s]+)/i);
    if (nonceMatch && nonceMatch[1]) {
      nonce = decodeURIComponent(nonceMatch[1]).trim();
    }
    return { sessionId: idPatternMatch[0].trim(), nonce };
  }

  // 5. Fallback alphanumeric token
  if (/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) {
    return { sessionId: trimmed };
  }

  throw new Error("Unrecognized BunkMates QR login format. Please scan a valid desktop QR code.");
};

/**
 * 2. Fetch session from Firestore with multi-collection support and safe expiration checks.
 */
export const getQRLoginSession = async (
  sessionId: string
): Promise<QRLoginSession | null> => {
  try {
    const collectionsToTry = [
      "device_pairings",
      "qr_login_sessions",
      "qr_logins",
      "qr_sessions",
    ];

    let snap: any = null;
    let activeCollection = "device_pairings";

    for (const coll of collectionsToTry) {
      const docRef = doc(db, coll, sessionId);
      const s = await getDoc(docRef);
      if (s.exists()) {
        snap = s;
        activeCollection = coll;
        break;
      }
    }

    if (!snap || !snap.exists()) {
      console.log(`[qrLoginService] Session document not found for ID: ${sessionId}`);
      return null;
    }

    const data = snap.data();
    const now = Date.now();
    let status = (data.status || "pending") as QRLoginStatus;

    // Evaluate legitimate expiration
    if (isSessionExpired(data)) {
      status = "expired";
    }

    const normalizedCreatedAt = normalizeTimestamp(data.createdAt) || now;
    const normalizedExpiresAt = normalizeTimestamp(data.expiresAt) || (normalizedCreatedAt + 10 * 60 * 1000);

    return {
      id: snap.id,
      collectionName: activeCollection,
      status,
      nonce: data.nonce,
      publicKey: data.publicKey,
      createdAt: normalizedCreatedAt,
      expiresAt: normalizedExpiresAt,
      requesterMetadata: {
        deviceName: data.requesterMetadata?.deviceName || "Desktop Computer",
        deviceType: data.requesterMetadata?.deviceType || "desktop",
        browser: data.requesterMetadata?.browser || "Web Browser",
        os: data.requesterMetadata?.os || "Desktop OS",
        ip: data.requesterMetadata?.ip,
        location: data.requesterMetadata?.location,
        userAgent: data.requesterMetadata?.userAgent,
      },
      approverUid: data.approverUid,
      userId: data.userId || data.approverUid || data.uid,
      uid: data.uid || data.approverUid || data.userId,
      userUid: data.userUid || data.approverUid || data.userId,
      email: data.email || data.user?.email,
      displayName: data.displayName || data.user?.displayName,
      photoURL: data.photoURL || data.user?.photoURL,
      phoneNumber: data.phoneNumber || data.user?.phoneNumber,
      user: data.user,
      userData: data.userData,
      userProfile: data.userProfile,
      idToken: data.idToken,
      token: data.token || data.idToken || data.customToken,
      authToken: data.authToken || data.token || data.idToken || data.customToken,
      customToken: data.customToken,
      approverDeviceId: data.approverDeviceId,
      approvedAt: normalizeTimestamp(data.approvedAt) || undefined,
      rejectedAt: normalizeTimestamp(data.rejectedAt) || undefined,
      rejectionReason: data.rejectionReason,
      consumedAt: normalizeTimestamp(data.consumedAt) || undefined,
    };
  } catch (err) {
    console.warn("[qrLoginService] Error fetching session:", err);
    return null;
  }
};

/**
 * 3. Record that the QR code was scanned by the mobile client.
 * Transitions status from "pending" to "scanned" so desktop can reflect scan progress.
 */
export const markQRLoginScanned = async (
  sessionId: string,
  collectionName: string = "device_pairings"
): Promise<void> => {
  try {
    const sessionDocRef = doc(db, collectionName, sessionId);
    const snap = await getDoc(sessionDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "pending") {
        await updateDoc(sessionDocRef, {
          status: "scanned",
          scannedAt: Date.now(),
        });
      }
    }
  } catch (err) {
    console.log("[qrLoginService] Note: markQRLoginScanned skipped/noted:", err);
  }
};

/**
 * 4. Securely approve the desktop QR login request.
 * Enforces authenticated user, checks expiration, single-use,
 * registers secondary device session, and triggers desktop authorization.
 * CRITICAL: Never logs out or modifies the mobile device's own authentication session.
 */
export const approveQRLoginRequest = async (params: {
  sessionId: string;
  collectionName?: string;
  approverUid?: string;
  approverDisplayName?: string;
}): Promise<void> => {
  const { sessionId, collectionName = "device_pairings", approverDisplayName } = params;

  // 1. Strictly verify the phone's currently active Firebase Auth user
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication verification failed. Please sign in to your mobile app first.");
  }
  const approverUid = currentUser.uid;

  // 2. Fetch the user's fresh profile and mint fresh ID Token
  let userProfileData: any = {};
  try {
    const userDocSnap = await getDoc(doc(db, "users", approverUid));
    if (userDocSnap.exists()) {
      userProfileData = userDocSnap.data() || {};
    }
  } catch (err) {
    console.log("[qrLoginService] User doc fetch note:", err);
  }

  let idToken = "";
  try {
    idToken = await currentUser.getIdToken(true);
  } catch (err) {
    console.log("[qrLoginService] getIdToken note:", err);
  }

  const userEmail = currentUser.email || userProfileData?.email || "";
  const userDisplayName =
    currentUser.displayName ||
    userProfileData?.displayName ||
    userProfileData?.name ||
    approverDisplayName ||
    "BunkMates User";
  const userPhotoURL =
    currentUser.photoURL ||
    userProfileData?.photoURL ||
    userProfileData?.profileImage ||
    userProfileData?.avatar ||
    "";
  const userPhoneNumber = currentUser.phoneNumber || userProfileData?.phoneNumber || "";

  const userObject = {
    uid: approverUid,
    email: userEmail,
    displayName: userDisplayName,
    photoURL: userPhotoURL,
    phoneNumber: userPhoneNumber,
  };

  const devId = await getPersistentDeviceId();
  const hw = getDeviceHardwareInfo(userDisplayName);

  // Attempt 1: Call trusted Firebase Cloud Function if deployed
  try {
    const approveFn = httpsCallable<
      {
        sessionId: string;
        collectionName?: string;
        approverDeviceId?: string;
        approverHardware?: any;
        idToken?: string;
        email?: string;
        displayName?: string;
        photoURL?: string;
        phoneNumber?: string;
        user?: any;
        userData?: any;
      },
      { success: boolean; message?: string }
    >(functions, "approveQrLogin");

    const res = await approveFn({
      sessionId,
      collectionName,
      approverDeviceId: devId,
      approverHardware: hw,
      idToken,
      email: userEmail,
      displayName: userDisplayName,
      photoURL: userPhotoURL,
      phoneNumber: userPhoneNumber,
      user: userObject,
      userData: userProfileData,
    });

    if (res?.data?.success) {
      return;
    }
  } catch (cloudFnErr: any) {
    const code = cloudFnErr?.code;
    const isUnimplemented =
      code === "functions/not-found" ||
      code === "not-found" ||
      cloudFnErr?.message?.includes("not-found");
    if (!isUnimplemented) {
      console.warn("[qrLoginService] Cloud Function call returned:", cloudFnErr);
    }
  }

  // Fallback: Atomic Firestore transaction to enforce single-use approval & validate states
  const sessionDocRef = doc(db, collectionName, sessionId);
  const now = Date.now();
  let createdDevice: any = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(sessionDocRef);
    if (!snap.exists()) {
      throw new Error("This QR login session was not found or has expired.");
    }

    const data = snap.data();

    // Check expiration safely
    if (isSessionExpired(data)) {
      throw new Error("This QR code has expired. Please refresh the QR code on your desktop screen.");
    }

    // Check if already approved, consumed, or rejected
    if (data.status === "approved" || data.status === "consumed") {
      throw new Error("This login request has already been approved and cannot be approved again.");
    }

    if (data.status === "rejected") {
      throw new Error("This login request was previously declined.");
    }

    const secondaryDeviceId = `dev_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const linkedDeviceData = {
      id: secondaryDeviceId,
      sessionId,
      pairingId: sessionId,
      deviceName: data.requesterMetadata?.deviceName || "Desktop Computer",
      deviceType: data.requesterMetadata?.deviceType || "desktop",
      browser: data.requesterMetadata?.browser || "Web Browser",
      os: data.requesterMetadata?.os || "Desktop OS",
      location: data.requesterMetadata?.location || "Nearby",
      ipAddress: data.requesterMetadata?.ip || "",
      lastActive: "Just now",
      lastActiveTimestamp: now,
      linkedAt: now,
      isActive: true,
      isCurrentDevice: false,
      pairingMethod: "qr",
    };

    createdDevice = linkedDeviceData;

    // 1. Authorize session with COMPLETE authenticated user payload
    const sessionAuthPayload = {
      status: "approved",
      approverUid,
      userId: approverUid,
      uid: approverUid,
      userUid: approverUid,
      email: userEmail,
      displayName: userDisplayName,
      photoURL: userPhotoURL,
      phoneNumber: userPhoneNumber,
      user: userObject,
      userData: userProfileData,
      userProfile: userProfileData,
      idToken: idToken || null,
      token: idToken || null,
      authToken: idToken || null,
      approverDeviceId: devId,
      approvedAt: now,
      approvedDevice: linkedDeviceData,
    };

    transaction.update(sessionDocRef, sessionAuthPayload);

    // 2. Register secondary device under user's profile
    const userDeviceDocRef = doc(db, "users", approverUid, "devices", secondaryDeviceId);
    transaction.set(userDeviceDocRef, linkedDeviceData);
  });

  // 3. Update login activity in user profile for full backward compatibility
  if (createdDevice) {
    try {
      const userDocRef = doc(db, "users", approverUid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const existingLogins: DeviceSession[] = Array.isArray(uData.security?.loginActivity)
          ? uData.security.loginActivity
          : [];

        const legacyFormat: DeviceSession = {
          id: createdDevice.id,
          deviceName: createdDevice.deviceName,
          deviceType: createdDevice.deviceType,
          location: `${createdDevice.location} • Just now`,
          lastActive: "Just now",
          isActive: true,
          os: createdDevice.os,
          lastActiveTimestamp: now,
        };

        await updateDoc(userDocRef, {
          "security.loginActivity": [legacyFormat, ...existingLogins],
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      console.log("[qrLoginService] Note updating user login activity:", err);
    }
  }
};

/**
 * 5. Reject the desktop QR login request.
 */
export const rejectQRLoginRequest = async (
  sessionId: string,
  reason: string = "Declined by user",
  collectionName: string = "device_pairings"
): Promise<void> => {
  try {
    const rejectFn = httpsCallable<{ sessionId: string; reason: string }, any>(
      functions,
      "rejectQrLogin"
    );
    await rejectFn({ sessionId, reason });
    return;
  } catch {
    // Fallback to direct Firestore update
  }

  try {
    const sessionDocRef = doc(db, collectionName, sessionId);
    await updateDoc(sessionDocRef, {
      status: "rejected",
      rejectionReason: reason,
      rejectedAt: Date.now(),
    });
  } catch (err) {
    console.warn("[qrLoginService] Error rejecting QR login request:", err);
  }
};

/**
 * 6. Real-time snapshot subscription for session lifecycle with safe expiry handling.
 */
export const subscribeToQRLoginSession = (
  sessionId: string,
  onUpdate: (session: QRLoginSession | null) => void,
  collectionName: string = "device_pairings"
): (() => void) => {
  const sessionDocRef = doc(db, collectionName, sessionId);
  return onSnapshot(
    sessionDocRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }

      const data = snap.data();
      const now = Date.now();
      let status = (data.status || "pending") as QRLoginStatus;

      // Safe expiration check
      if (isSessionExpired(data)) {
        status = "expired";
      }

      const normalizedCreatedAt = normalizeTimestamp(data.createdAt) || now;
      const normalizedExpiresAt = normalizeTimestamp(data.expiresAt) || (normalizedCreatedAt + 10 * 60 * 1000);

      onUpdate({
        id: snap.id,
        collectionName,
        status,
        nonce: data.nonce,
        publicKey: data.publicKey,
        createdAt: normalizedCreatedAt,
        expiresAt: normalizedExpiresAt,
        requesterMetadata: {
          deviceName: data.requesterMetadata?.deviceName || "Desktop Computer",
          deviceType: data.requesterMetadata?.deviceType || "desktop",
          browser: data.requesterMetadata?.browser || "Web Browser",
          os: data.requesterMetadata?.os || "Desktop OS",
          ip: data.requesterMetadata?.ip,
          location: data.requesterMetadata?.location,
          userAgent: data.requesterMetadata?.userAgent,
        },
        approverUid: data.approverUid,
        userId: data.userId || data.approverUid || data.uid,
        uid: data.uid || data.approverUid || data.userId,
        userUid: data.userUid || data.approverUid || data.userId,
        email: data.email || data.user?.email,
        displayName: data.displayName || data.user?.displayName,
        photoURL: data.photoURL || data.user?.photoURL,
        phoneNumber: data.phoneNumber || data.user?.phoneNumber,
        user: data.user,
        userData: data.userData,
        userProfile: data.userProfile,
        idToken: data.idToken,
        token: data.token || data.idToken || data.customToken,
        authToken: data.authToken || data.token || data.idToken || data.customToken,
        customToken: data.customToken,
        approverDeviceId: data.approverDeviceId,
        approvedAt: normalizeTimestamp(data.approvedAt) || undefined,
        rejectedAt: normalizeTimestamp(data.rejectedAt) || undefined,
        rejectionReason: data.rejectionReason,
        consumedAt: normalizeTimestamp(data.consumedAt) || undefined,
      });
    },
    (err) => {
      console.warn("[qrLoginService] Snapshot listener error:", err);
    }
  );
};

/**
 * 7. AsyncStorage helpers for preserving pending QR login across authentication.
 */
export const storePendingQRLogin = async (sessionId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_QR_LOGIN_KEY, sessionId);
  } catch (e) {
    console.warn("[qrLoginService] Error storing pending QR login:", e);
  }
};

export const getPendingQRLogin = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(PENDING_QR_LOGIN_KEY);
  } catch (e) {
    return null;
  }
};

export const clearPendingQRLogin = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_QR_LOGIN_KEY);
  } catch (e) {
    // safe ignore
  }
};
