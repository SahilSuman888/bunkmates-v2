// **@** Shared Session & Device Tracking utility for live multi-device synchronization
import * as Device from "expo-device";
import * as Location from "expo-location";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export const DEVICE_STORAGE_KEY = "@bunkmates_current_device_id";

export interface DeviceSession {
  id: string;
  deviceName: string;
  deviceType: "phone" | "tablet" | "desktop";
  location: string;
  lastActive: string;
  isActive: boolean;
  os?: string;
  lastActiveTimestamp?: number;
}

export interface TrustedDevice {
  id: string;
  name: string;
  deviceType: "phone" | "tablet" | "desktop";
  approvedAt: string;
  isCurrentDevice?: boolean;
}

// **@** Resolve hardware device name and category accurately
export const getDeviceHardwareInfo = (userName?: string): { name: string; type: "phone" | "tablet" | "desktop"; os: string } => {
  let type: "phone" | "tablet" | "desktop" = "phone";
  if (Device.deviceType === Device.DeviceType.TABLET) {
    type = "tablet";
  } else if (Device.deviceType === Device.DeviceType.DESKTOP) {
    type = "desktop";
  }

  const deviceName = Device.deviceName;
  const modelName = Device.modelName;
  const brand = Device.brand;
  const os = `${Device.osName || (Platform.OS === "ios" ? "iOS" : "Android")} ${Device.osVersion || ""}`.trim();

  let name = "";
  if (deviceName && deviceName.trim().length > 0 && deviceName !== "iPhone" && deviceName !== "Android") {
    name = deviceName.trim();
  } else if (modelName && modelName.trim().length > 0) {
    if (brand && !modelName.toLowerCase().includes(brand.toLowerCase())) {
      name = `${brand} ${modelName}`.trim();
    } else {
      name = modelName.trim();
    }
  } else if (brand) {
    name = `${brand} ${Platform.OS === "ios" ? "Device" : "Phone"}`;
  } else {
    const firstName = userName ? userName.trim().split(" ")[0] : "";
    const base = Platform.OS === "ios" ? (type === "tablet" ? "iPad" : "iPhone") : "Android Device";
    name = firstName ? `${firstName}'s ${base}` : base;
  }

  return { name, type, os };
};

// **@** Get or persist unique device identifier
export const getPersistentDeviceId = async (): Promise<string> => {
  try {
    let id = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await AsyncStorage.setItem(DEVICE_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
};

// **@** Detect real location without hardcoded mock fallbacks
export const getRealLocation = async (userCity?: string): Promise<string> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo && geo.length > 0) {
        const item = geo[0];
        const parts = [item.city || item.subregion || item.district, item.country || item.region].filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
      }
    }
  } catch {
    // location error ignored
  }

  if (userCity && userCity.trim().length > 0) {
    return userCity.trim();
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const parts = tz.split("/");
      const cityOrRegion = parts[parts.length - 1].replace(/_/g, " ");
      return cityOrRegion;
    }
  } catch {
    // ignore
  }

  return "Current Location";
};

// **@** Automatically record/update this device's active session in Firestore
export const recordDeviceSessionInFirestore = async (user: any): Promise<void> => {
  if (!user?.uid) return;
  try {
    const devId = await getPersistentDeviceId();
    const hardware = getDeviceHardwareInfo(user.displayName);
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let existingLogins: DeviceSession[] = [];
    let userCity = "";

    if (snap.exists()) {
      const data = snap.data();
      userCity = data.homeCity || data.city || "";
      if (Array.isArray(data.security?.loginActivity)) {
        // Strip out any legacy static mock entries
        existingLogins = data.security.loginActivity.filter(
          (s: any) => s.id !== "sess_desktop_chrome" && s.id !== "mock_session"
        );
      }
    }

    const locationPromise = getRealLocation(userCity);
    const timeoutPromise = new Promise<string>((res) => setTimeout(() => res(userCity || "Active Location"), 1200));
    const location = await Promise.race([locationPromise, timeoutPromise]);

    // Keep other sessions intact, updating their lastActive label if timestamp exists
    const otherSessions = existingLogins.filter((s) => s.id !== devId).map((s) => {
      // If last active was within 10 minutes, mark as active
      const isStillActive = s.lastActiveTimestamp && Date.now() - s.lastActiveTimestamp < 10 * 60 * 1000;
      return {
        ...s,
        isActive: !!isStillActive,
      };
    });

    const currentSession: DeviceSession = {
      id: devId,
      deviceName: hardware.name,
      deviceType: hardware.type,
      location: `${location} • Just now`,
      lastActive: "Just now",
      isActive: true,
      os: hardware.os,
      lastActiveTimestamp: Date.now(),
    };

    const finalSessions = [currentSession, ...otherSessions];

    await updateDoc(userRef, {
      "security.loginActivity": finalSessions,
      updatedAt: new Date(),
    });
  } catch (e) {
    console.log("Error recording device session:", e);
  }
};
