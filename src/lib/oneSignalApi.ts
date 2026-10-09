import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export interface OneSignalNotificationRequest {
  externalUserIds: string[];
  headings: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, unknown>;
  androidChannelId?: string;
  priority?: number;
  buttons?: Array<{ id: string; text: string; icon?: string }>;
  contentAvailable?: boolean;
  ttl?: number;
  largeIcon?: string;
  androidSound?: string;
  androidAccentColor?: string;
}

export async function sendOneSignalNotification(
  request: OneSignalNotificationRequest
) {
  const sendNotification = httpsCallable<
    OneSignalNotificationRequest,
    Record<string, unknown>
  >(functions, "sendOneSignalNotification");
  const result = await sendNotification(request);
  return result.data;
}
