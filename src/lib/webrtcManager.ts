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

export let RTCPeerConnection: any = null;
export let RTCIceCandidate: any = null;
export let RTCSessionDescription: any = null;
export let mediaDevices: any = null;
export let RTCView: any = null;
export let MediaStream: any = null;

try {
  const webrtc = require("react-native-webrtc");
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  mediaDevices = webrtc.mediaDevices;
  RTCView = webrtc.RTCView;
  MediaStream = webrtc.MediaStream;
} catch (e) {
  console.log("react-native-webrtc native module not loaded:", e);
}

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
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
  iceCandidatePoolSize: 10,
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
  private onConnectionStateCallback: ((state: string) => void) | null = null;
  private candidateQueue: any[] = [];
  private isRemoteDescriptionSet = false;

  constructor(callDocId: string) {
    this.callDocId = callDocId;
  }

  public setOnRemoteStream(cb: (stream: any) => void) {
    this.onRemoteStreamCallback = cb;
    if (this.remoteStream && cb) {
      cb(this.remoteStream);
    }
  }

  public setOnLocalStream(cb: (stream: any) => void) {
    this.onLocalStreamCallback = cb;
    if (this.localStream && cb) {
      cb(this.localStream);
    }
  }

  public setOnConnectionStateChange(cb: (state: string) => void) {
    this.onConnectionStateCallback = cb;
  }

  public getLocalStream() {
    return this.localStream;
  }

  public getRemoteStream() {
    return this.remoteStream;
  }

  public isSupported(): boolean {
    return !!RTCPeerConnection && !!mediaDevices;
  }

  private setupPeerConnection(isVideo: boolean) {
    this.peerConnection = new RTCPeerConnection(configuration);
    this.isRemoteDescriptionSet = false;
    this.candidateQueue = [];

    // Connection state handler
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`[WebRTC] Connection state: ${state}`);
      if (this.onConnectionStateCallback && state) {
        this.onConnectionStateCallback(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log(`[WebRTC] ICE Connection state: ${iceState}`);
      if (
        (iceState === "connected" || iceState === "completed") &&
        this.onConnectionStateCallback
      ) {
        this.onConnectionStateCallback("connected");
      }
    };

    // Remote Track Listener (Standard Unified Plan)
    this.peerConnection.ontrack = (event: any) => {
      console.log("[WebRTC] ontrack received:", event.track?.kind, "streams:", event.streams?.length);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else if (event.track) {
        if (!this.remoteStream) {
          this.remoteStream = MediaStream ? new MediaStream() : null;
        }
        if (this.remoteStream && typeof this.remoteStream.addTrack === "function") {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (event.track) {
        event.track.onunmute = () => {
          console.log(`[WebRTC] Track unmuted: ${event.track.kind}`);
          if (this.onRemoteStreamCallback && this.remoteStream) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
        };
      }

      if (this.onRemoteStreamCallback && this.remoteStream) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // Remote Stream Listener (Legacy fallback)
    this.peerConnection.onaddstream = (event: any) => {
      console.log("[WebRTC] onaddstream received:", event.stream?.id);
      if (event.stream) {
        this.remoteStream = event.stream;
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      }
    };
  }

  private async processCandidateQueue() {
    if (!this.peerConnection || !this.isRemoteDescriptionSet) return;
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(cand);
        console.log("[WebRTC] Successfully added queued ICE candidate");
      } catch (e) {
        console.warn("[WebRTC] Error adding queued ICE candidate:", e);
      }
    }
  }

  private async safelyAddCandidate(candidateData: any) {
    if (!candidateData || !candidateData.candidate) return;
    try {
      const candidate = new RTCIceCandidate(candidateData);
      if (this.isRemoteDescriptionSet && this.peerConnection?.remoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
        console.log("[WebRTC] Added ICE candidate directly");
      } else {
        this.candidateQueue.push(candidate);
        console.log("[WebRTC] Queued ICE candidate (waiting for remote description)");
      }
    } catch (e) {
      console.warn("[WebRTC] Failed to instantiate/add candidate:", e);
    }
  }

  public async startCaller(isVideo: boolean = false) {
    if (!this.isSupported()) {
      console.warn("[WebRTC] WebRTC is not supported in this environment");
      return;
    }

    try {
      console.log(`[WebRTC] Starting caller (isVideo: ${isVideo}) for doc ${this.callDocId}`);
      this.setupPeerConnection(isVideo);

      // 1. Get Local Media Stream (Mic + Camera)
      const constraints: any = {
        audio: true,
        video: isVideo
          ? {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            }
          : false,
      };

      this.localStream = await mediaDevices.getUserMedia(constraints);
      console.log("[WebRTC] Got local media stream with tracks:", this.localStream.getTracks().map((t: any) => `${t.kind}:${t.enabled}`));

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }

      // Add tracks to PeerConnection
      if (typeof this.peerConnection.addTrack === "function") {
        this.localStream.getTracks().forEach((track: any) => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      } else if (typeof this.peerConnection.addStream === "function") {
        this.peerConnection.addStream(this.localStream);
      }

      // 2. ICE Candidate Gathering & Signaling
      const callerCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "callerCandidates"
      );

      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          const candidateData = event.candidate.toJSON
            ? event.candidate.toJSON()
            : {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
              };

          // Filter out any undefined fields
          const cleanData: any = {};
          Object.keys(candidateData).forEach((k) => {
            if (candidateData[k] !== undefined) cleanData[k] = candidateData[k];
          });

          addDoc(callerCandidatesCol, cleanData).catch((err) => {
            console.warn("[WebRTC] Error writing caller candidate:", err);
          });
        }
      };

      // 3. Create & Set Local SDP Offer
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      };

      const offer = await this.peerConnection.createOffer(offerOptions);
      await this.peerConnection.setLocalDescription(offer);

      const callDocRef = doc(db, "calls", this.callDocId);
      await setDoc(
        callDocRef,
        {
          offer: { type: offer.type, sdp: offer.sdp },
        },
        { merge: true }
      );
      console.log("[WebRTC] Offer written to Firestore");

      // 4. Listen for Callee Answer
      this.unsubCall = onSnapshot(callDocRef, async (snap) => {
        const data = snap.data();
        if (data?.answer && !this.peerConnection?.remoteDescription) {
          console.log("[WebRTC] Received Callee Answer SDP");
          try {
            const rsd = new RTCSessionDescription(data.answer);
            await this.peerConnection.setRemoteDescription(rsd);
            this.isRemoteDescriptionSet = true;
            console.log("[WebRTC] Caller setRemoteDescription success!");
            await this.processCandidateQueue();
          } catch (err) {
            console.error("[WebRTC] Caller setRemoteDescription error:", err);
          }
        }
      });

      // 5. Listen for Callee ICE Candidates
      const calleeCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "calleeCandidates"
      );

      this.unsubCandidates = onSnapshot(calleeCandidatesCol, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            this.safelyAddCandidate(change.doc.data());
          }
        });
      });
    } catch (e) {
      console.error("[WebRTC] startCaller fatal error:", e);
    }
  }

  public async startCallee(isVideo: boolean = false) {
    if (!this.isSupported()) {
      console.warn("[WebRTC] WebRTC is not supported in this environment");
      return;
    }

    try {
      console.log(`[WebRTC] Starting callee (isVideo: ${isVideo}) for doc ${this.callDocId}`);
      const callDocRef = doc(db, "calls", this.callDocId);
      let callData = (await getDoc(callDocRef)).data();

      // If offer hasn't arrived yet, wait up to 4 seconds
      if (!callData?.offer) {
        await new Promise<void>((resolve) => {
          const unsub = onSnapshot(callDocRef, (snap) => {
            if (snap.data()?.offer) {
              callData = snap.data();
              unsub();
              resolve();
            }
          });
          setTimeout(() => {
            unsub();
            resolve();
          }, 4000);
        });
      }

      if (!callData?.offer) {
        console.error("[WebRTC] startCallee: Offer not found in Firestore");
        return;
      }

      this.setupPeerConnection(isVideo);

      // 1. Get Local Media Stream (Mic + Camera)
      const constraints: any = {
        audio: true,
        video: isVideo
          ? {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            }
          : false,
      };

      this.localStream = await mediaDevices.getUserMedia(constraints);
      console.log("[WebRTC] Callee got local stream with tracks:", this.localStream.getTracks().map((t: any) => `${t.kind}:${t.enabled}`));

      if (this.onLocalStreamCallback) {
        this.onLocalStreamCallback(this.localStream);
      }

      // Add tracks to PeerConnection
      if (typeof this.peerConnection.addTrack === "function") {
        this.localStream.getTracks().forEach((track: any) => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      } else if (typeof this.peerConnection.addStream === "function") {
        this.peerConnection.addStream(this.localStream);
      }

      // 2. ICE Candidate Gathering & Signaling
      const calleeCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "calleeCandidates"
      );

      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          const candidateData = event.candidate.toJSON
            ? event.candidate.toJSON()
            : {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
              };

          const cleanData: any = {};
          Object.keys(candidateData).forEach((k) => {
            if (candidateData[k] !== undefined) cleanData[k] = candidateData[k];
          });

          addDoc(calleeCandidatesCol, cleanData).catch((err) => {
            console.warn("[WebRTC] Error writing callee candidate:", err);
          });
        }
      };

      // 3. Set Remote Offer & Create Answer
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(callData.offer)
      );
      this.isRemoteDescriptionSet = true;
      console.log("[WebRTC] Callee setRemoteDescription success!");

      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await this.peerConnection.setLocalDescription(answer);

      await updateDoc(callDocRef, {
        answer: { type: answer.type, sdp: answer.sdp },
      });
      console.log("[WebRTC] Answer written to Firestore");

      await this.processCandidateQueue();

      // 4. Listen for Caller ICE Candidates
      const callerCandidatesCol = collection(
        db,
        "calls",
        this.callDocId,
        "callerCandidates"
      );

      this.unsubCandidates = onSnapshot(callerCandidatesCol, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            this.safelyAddCandidate(change.doc.data());
          }
        });
      });
    } catch (e) {
      console.error("[WebRTC] startCallee fatal error:", e);
    }
  }

  public setMute(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !muted;
        console.log(`[WebRTC] Audio track enabled set to: ${!muted}`);
      });
    }
  }

  public setCameraEnabled(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: any) => {
        track.enabled = enabled;
        console.log(`[WebRTC] Video track enabled set to: ${enabled}`);
      });
    }
  }

  public switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        if (typeof videoTrack._switchCamera === "function") {
          videoTrack._switchCamera();
          console.log("[WebRTC] Switched camera via track._switchCamera");
        } else if (typeof videoTrack.switchCamera === "function") {
          videoTrack.switchCamera();
          console.log("[WebRTC] Switched camera via track.switchCamera");
        }
      }
    }
  }

  public endCall() {
    console.log(`[WebRTC] Ending call for ${this.callDocId}`);
    if (this.unsubCall) {
      this.unsubCall();
      this.unsubCall = null;
    }
    if (this.unsubCandidates) {
      this.unsubCandidates();
      this.unsubCandidates = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t: any) => {
        try {
          t.stop();
        } catch (e) {}
      });
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t: any) => {
        try {
          t.stop();
        } catch (e) {}
      });
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    this.candidateQueue = [];
    this.isRemoteDescriptionSet = false;
  }
}
