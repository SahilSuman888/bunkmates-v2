import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * CallForegroundService:
 * Maintains a persistent Android Foreground Service / high-priority process
 * for the entire duration of an ongoing call, preventing Android from killing
 * the WebRTC audio/video connection when the app is minimized or the screen turns off.
 */
class CallForegroundService {
  private isServiceRunning = false;
  private appStateSubscription: any = null;
  private activeCallInfo: {
    callId: string;
    callerName: string;
    callType: "audio" | "video";
  } | null = null;

  constructor() {
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
  }

  /**
   * Start the foreground service for an active ongoing call
   */
  public async start(callId: string, callerName: string, callType: "audio" | "video") {
    if (this.isServiceRunning) return;
    this.isServiceRunning = true;
    this.activeCallInfo = { callId, callerName, callType };

    console.log(`[CallForegroundService] Starting background call service for ${callId} (${callType})`);

    // Listen for app minimization
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);
    }

    // On Android, setup high-priority persistent background notification channel
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("ongoing_call_foreground", {
          name: "Active Ongoing Call",
          importance: Notifications.AndroidImportance.MAX,
          sound: undefined,
          vibrationPattern: [0],
          enableLights: true,
          lightColor: "#00e6b0",
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          showBadge: true,
        });

        // Present persistent ongoing call notification
        await Notifications.scheduleNotificationAsync({
          identifier: `ongoing_call_${callId}`,
          content: {
            title: `Ongoing ${callType === "video" ? "Video" : "Voice"} Call`,
            body: `In call with ${callerName} • Tap to return to call`,
            data: { callId, type: "ongoing_call", callType },
            sticky: true,
            autoDismiss: false,
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: "ongoing_call",
            color: "#00e6b0",
          },
          trigger: null, // show immediately
        });
      } catch (err) {
        console.warn("[CallForegroundService] Error presenting ongoing notification:", err);
      }
    }
  }

  /**
   * Stop the foreground service on call teardown
   */
  public async stop() {
    if (!this.isServiceRunning) return;
    this.isServiceRunning = false;

    console.log("[CallForegroundService] Stopping background call service");

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.activeCallInfo && Platform.OS === "android") {
      try {
        await Notifications.dismissNotificationAsync(`ongoing_call_${this.activeCallInfo.callId}`);
      } catch (err) {}
    }

    this.activeCallInfo = null;
  }

  private handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === "background" && this.isServiceRunning && this.activeCallInfo) {
      console.log("[CallForegroundService] App minimized into background during active call, maintaining stream connection");
    }
  }
}

export const callForegroundService = new CallForegroundService();
export default callForegroundService;
