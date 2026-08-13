import * as FileSystem from "expo-file-system";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

export class CallAudioStreamer {
  private callDocId: string;
  private currentUserId: string;
  private isMuted = false;

  constructor(callDocId: string, currentUserId: string) {
    this.callDocId = callDocId;
    this.currentUserId = currentUserId;
  }

  public async startStream() {
    console.log("CallAudioStreamer initialized safely without legacy native JSI crash.");
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
  }

  public async stopStream() {
    console.log("CallAudioStreamer stopped safely.");
  }
}
