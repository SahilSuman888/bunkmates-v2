import Constants from "expo-constants";

export const isExpoGo =
  Constants.appOwnership === "expo" ||
  (Constants as any).executionEnvironment === "storeClient";

let NotificationsModule: any = null;

try {
  // Remote push notifications in expo-notifications throw an error in Expo Go on SDK 53+
  if (!isExpoGo) {
    NotificationsModule = require("expo-notifications");
  }
} catch (e) {
  // Safely catch error when running in Expo Go or environment without native notification support
}

// Fallback mock implementations when running in Expo Go or when expo-notifications is unavailable
const mockNotifications = {
  setNotificationHandler: (handler: any) => {},
  setNotificationChannelAsync: async (channelId: string, channel: any) => null,
  setNotificationCategoryAsync: async (categoryId: string, actions: any) => null,
  scheduleNotificationAsync: async (request: any) => "mock-notification-id",
  dismissNotificationAsync: async (id: string) => {},
  cancelScheduledNotificationAsync: async (id: string) => {},
  getPermissionsAsync: async () => ({
    status: "denied",
    granted: false,
    canAskAgain: false,
    expires: "never",
  }),
  requestPermissionsAsync: async () => ({
    status: "denied",
    granted: false,
    canAskAgain: false,
    expires: "never",
  }),
  getExpoPushTokenAsync: async (options?: any) => ({ data: null }),
  addNotificationReceivedListener: (listener: any) => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: (listener: any) => ({ remove: () => {} }),
  AndroidImportance: {
    UNSPECIFIED: 0,
    NONE: 1,
    MIN: 2,
    LOW: 3,
    DEFAULT: 4,
    HIGH: 5,
    MAX: 6,
  },
  AndroidNotificationVisibility: {
    UNKNOWN: 0,
    PUBLIC: 1,
    PRIVATE: 2,
    SECRET: -1,
  },
  AndroidNotificationPriority: {
    MIN: -2,
    LOW: -1,
    DEFAULT: 0,
    HIGH: 1,
    MAX: 2,
  },
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    DATE: "date",
    MONTHLY: "monthly",
    TIME_INTERVAL: "timeInterval",
    WEEKLY: "weekly",
    YEARLY: "yearly",
  },
  AndroidAudioUsage: {
    UNKNOWN: 0,
    MEDIA: 1,
    VOICE_COMMUNICATION: 2,
    VOICE_COMMUNICATION_SIGNALLING: 3,
    ALARM: 4,
    NOTIFICATION: 5,
    RINGTONE: 6,
    ACCESSIBILITY: 11,
  },
  AndroidAudioContentType: {
    UNKNOWN: 0,
    SPEECH: 1,
    MUSIC: 2,
    MOVIE: 3,
    SONIFICATION: 4,
  },
};

const safeNotifications = NotificationsModule || mockNotifications;
if (!safeNotifications.AndroidAudioUsage) {
  safeNotifications.AndroidAudioUsage = mockNotifications.AndroidAudioUsage;
}
if (!safeNotifications.AndroidAudioContentType) {
  safeNotifications.AndroidAudioContentType = mockNotifications.AndroidAudioContentType;
}

export default safeNotifications;
export const AndroidImportance = safeNotifications.AndroidImportance;
export const AndroidNotificationVisibility = safeNotifications.AndroidNotificationVisibility;
export const AndroidNotificationPriority = safeNotifications.AndroidNotificationPriority;
export const SchedulableTriggerInputTypes = safeNotifications.SchedulableTriggerInputTypes;
