import { Platform } from "react-native";

let InCallManager: any = null;
try {
  const incall = require("react-native-incall-manager");
  InCallManager = incall.default || incall;
} catch (e) {
  console.log("[InCallManager] Native module not available or in Expo Go:", e);
}

export type AndroidAudioRoute = "earpiece" | "speaker" | "bluetooth";

/**
 * AudioRouteManager: Controls Android audio routing (Loudspeaker, Call Earpiece, Bluetooth)
 * and manages in-call hardware lifecycle using react-native-incall-manager.
 */
export class AudioRouteManager {
  private static isStarted = false;

  public static start(mediaType: "audio" | "video" = "audio") {
    if (!InCallManager) return;
    try {
      if (!this.isStarted) {
        InCallManager.start({ media: mediaType, auto: true });
        if (typeof InCallManager.setKeepScreenOn === "function") {
          InCallManager.setKeepScreenOn(true);
        }
        this.isStarted = true;
        console.log(`[InCallManager] Started for ${mediaType} call`);
      }
    } catch (err) {
      console.warn("[InCallManager] start error:", err);
    }
  }

  public static stop() {
    if (!InCallManager) return;
    try {
      if (this.isStarted) {
        if (typeof InCallManager.setKeepScreenOn === "function") {
          InCallManager.setKeepScreenOn(false);
        }
        if (typeof InCallManager.setSpeakerphoneOn === "function") {
          InCallManager.setSpeakerphoneOn(false);
        }
        if (typeof InCallManager.setForceSpeakerphoneOn === "function") {
          InCallManager.setForceSpeakerphoneOn(false);
        }
        InCallManager.stop();
        this.isStarted = false;
        console.log("[InCallManager] Stopped successfully");
      }
    } catch (err) {
      console.warn("[InCallManager] stop error:", err);
    }
  }

  public static setRoute(route: AndroidAudioRoute) {
    if (!InCallManager) return;
    try {
      switch (route) {
        case "speaker":
          if (typeof InCallManager.setSpeakerphoneOn === "function") {
            InCallManager.setSpeakerphoneOn(true);
          }
          if (typeof InCallManager.setForceSpeakerphoneOn === "function") {
            InCallManager.setForceSpeakerphoneOn(true);
          }
          if (typeof InCallManager.chooseAudioRoute === "function") {
            InCallManager.chooseAudioRoute("SPEAKER_PHONE");
          }
          console.log("[InCallManager] Switched to Main Loudspeaker");
          break;
        case "earpiece":
          if (typeof InCallManager.setSpeakerphoneOn === "function") {
            InCallManager.setSpeakerphoneOn(false);
          }
          if (typeof InCallManager.setForceSpeakerphoneOn === "function") {
            InCallManager.setForceSpeakerphoneOn(false);
          }
          if (typeof InCallManager.chooseAudioRoute === "function") {
            InCallManager.chooseAudioRoute("EARPIECE");
          }
          console.log("[InCallManager] Switched to Call Earpiece");
          break;
        case "bluetooth":
          if (typeof InCallManager.chooseAudioRoute === "function") {
            InCallManager.chooseAudioRoute("BLUETOOTH");
          }
          console.log("[InCallManager] Switched to Bluetooth Headset");
          break;
      }
    } catch (err) {
      console.warn(`[InCallManager] setRoute ${route} error:`, err);
    }
  }

  public static setMute(muted: boolean) {
    if (!InCallManager) return;
    try {
      if (typeof InCallManager.setMicrophoneMute === "function") {
        InCallManager.setMicrophoneMute(muted);
      }
    } catch (err) {
      console.warn("[InCallManager] setMute error:", err);
    }
  }
}

export { InCallManager };
export default AudioRouteManager;
