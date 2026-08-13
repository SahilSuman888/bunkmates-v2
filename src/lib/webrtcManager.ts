import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

let RTCPeerConnection: any = null;
let RTCIceCandidate: any = null;
let RTCSessionDescription: any = null;
let mediaDevices: any = null;

try {
  const webrtc = require("react-native-webrtc");
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  mediaDevices = webrtc.mediaDevices;
} catch (e) {
  console.log("react-native-webrtc module not linked in Expo Go context");
}

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelay",
      credential: "openrelay",
    },
  ],
};

export class WebRTCManager {
  private peerConnection: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private callDocId: string;
  private unsubCall: any = null;
  private unsubCandidates: any = null;
  private onRemoteStreamCallback: ((stream: any) => void) | null = null;
  private onLocalStreamCallback: ((stream: any) => void) | null = null;

  constructor(callDocId: string) {
    this.callDocId = callDocId;
  }

  public setOnRemoteStream(cb: (stream: any) => void) {
    this.onRemoteStreamCallback = cb;
  }

  public setOnLocalStream(cb: (stream: any) => void) {
    this.onLocalStreamCallback = cb;
  }

  public isSupported(): boolean {
    return !!RTCPeerConnection && !!mediaDevices;
  }

  public async startCaller(isVideo: boolean = false) {
    if (!this.isSupported()) return;

    try {
      this.peerConnection = new RTCPeerConnection(configuration);

      // 1. Get Local Mic/Camera Stream
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }

      this.localStream.getTracks().forEach((track: any) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // 2. Handle Remote Stream
      this.peerConnection.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
        }
      };

      // 3. ICE Candidate Signaling
      const callerCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "callerCandidates"
      );

      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          addDoc(callerCandidatesCol, event.candidate.toJSON()).catch(() => {});
        }
      };

      // 4. Create & Send SDP Offer
      const offer = await this.peerConnection.createOffer({});
      await this.peerConnection.setLocalDescription(offer);

      const callDocRef = doc(db, "calls", this.callDocId);
      await setDoc(
        callDocRef,
        {
          offer: { type: offer.type, sdp: offer.sdp },
        },
        { merge: true }
      );

      // 5. Listen for Receiver Answer
      this.unsubCall = onSnapshot(callDocRef, (snap) => {
        const data = snap.data();
        if (
          data?.answer &&
          !this.peerConnection.currentRemoteDescription
        ) {
          const rsd = new RTCSessionDescription(data.answer);
          this.peerConnection.setRemoteDescription(rsd).catch(console.error);
        }
      });

      // 6. Listen for Receiver ICE Candidates
      const calleeCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "calleeCandidates"
      );
      this.unsubCandidates = onSnapshot(calleeCandidatesCol, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            this.peerConnection
              .addIceCandidate(candidate)
              .catch(console.error);
          }
        });
      });
    } catch (e) {
      console.error("WebRTC startCaller error:", e);
    }
  }

  public async startCallee(isVideo: boolean = false) {
    if (!this.isSupported()) return;

    try {
      const callDocRef = doc(db, "calls", this.callDocId);
      let data = (await getDoc(callDocRef)).data();

      if (!data?.offer) {
        // Wait up to 3 seconds for offer to arrive in Firestore
        await new Promise<void>((resolve) => {
          const unsub = onSnapshot(callDocRef, (snap) => {
            if (snap.data()?.offer) {
              data = snap.data();
              unsub();
              resolve();
            }
          });
          setTimeout(() => {
            unsub();
            resolve();
          }, 3000);
        });
      }

      if (!data?.offer) {
        console.log("WebRTC startCallee: offer not found in Firestore");
        return;
      }

      this.peerConnection = new RTCPeerConnection(configuration);

      // 1. Get Local Mic/Camera Stream
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }

      this.localStream.getTracks().forEach((track: any) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // 2. Handle Remote Stream
      this.peerConnection.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
        }
      };

      // 3. ICE Candidate Signaling
      const calleeCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "calleeCandidates"
      );

      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCol, event.candidate.toJSON()).catch(() => {});
        }
      };

      // 4. Set Remote Offer & Create Answer
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      await updateDoc(callDocRef, {
        answer: { type: answer.type, sdp: answer.sdp },
      });

      // 5. Listen for Caller ICE Candidates
      const callerCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "callerCandidates"
      );
      this.unsubCandidates = onSnapshot(callerCandidatesCol, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            this.peerConnection
              .addIceCandidate(candidate)
              .catch(console.error);
          }
        });
      });
    } catch (e) {
      console.error("WebRTC startCallee error:", e);
    }
  }

  public setMute(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !muted;
      });
    }
  }

  public endCall() {
    if (this.unsubCall) {
      this.unsubCall();
      this.unsubCall = null;
    }
    if (this.unsubCandidates) {
      this.unsubCandidates();
      this.unsubCandidates = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t: any) => t.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
