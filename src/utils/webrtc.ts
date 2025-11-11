import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export interface Participant {
  userId: string;
  userName: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private meetingId: string;
  private userId: string;
  private userName: string;
  private channel: any;
  private onParticipantJoined?: (participant: Participant) => void;
  private onParticipantLeft?: (userId: string) => void;
  private onStreamAdded?: (userId: string, stream: MediaStream) => void;

  constructor(
    meetingId: string,
    userId: string,
    userName: string,
    callbacks: {
      onParticipantJoined?: (participant: Participant) => void;
      onParticipantLeft?: (userId: string) => void;
      onStreamAdded?: (userId: string, stream: MediaStream) => void;
    }
  ) {
    this.meetingId = meetingId;
    this.userId = userId;
    this.userName = userName;
    this.onParticipantJoined = callbacks.onParticipantJoined;
    this.onParticipantLeft = callbacks.onParticipantLeft;
    this.onStreamAdded = callbacks.onStreamAdded;
  }

  async initialize(localStream: MediaStream) {
    // Use the provided local media stream
    this.localStream = localStream;

    // Set up Supabase realtime channel for signaling
    this.channel = supabase.channel(`meeting:${this.meetingId}`);

    // Listen for presence sync
    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel.presenceState();
      console.log("Presence sync:", state);
      
      Object.keys(state).forEach((key) => {
        const presence = state[key][0];
        if (presence.userId !== this.userId && !this.peers.has(presence.userId)) {
          console.log("New participant detected:", presence.userId);
          this.onParticipantJoined?.({
            userId: presence.userId,
            userName: presence.userName,
          });
        }
      });
    });

    // Listen for presence join
    this.channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log("Participant joined:", newPresences);
      newPresences.forEach((presence: any) => {
        if (presence.userId !== this.userId) {
          this.createPeerConnection(presence.userId, true);
        }
      });
    });

    // Listen for presence leave
    this.channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      console.log("Participant left:", leftPresences);
      leftPresences.forEach((presence: any) => {
        this.removePeer(presence.userId);
        this.onParticipantLeft?.(presence.userId);
      });
    });

    // Listen for WebRTC signaling messages
    this.channel.on("broadcast", { event: "offer" }, ({ payload }) => {
      if (payload.to === this.userId) {
        console.log("Received offer from:", payload.from);
        this.handleOffer(payload.from, payload.offer);
      }
    });

    this.channel.on("broadcast", { event: "answer" }, ({ payload }) => {
      if (payload.to === this.userId) {
        console.log("Received answer from:", payload.from);
        this.handleAnswer(payload.from, payload.answer);
      }
    });

    this.channel.on("broadcast", { event: "ice-candidate" }, ({ payload }) => {
      if (payload.to === this.userId) {
        console.log("Received ICE candidate from:", payload.from);
        this.handleIceCandidate(payload.from, payload.candidate);
      }
    });

    // Subscribe and announce presence
    await this.channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await this.channel.track({
          userId: this.userId,
          userName: this.userName,
          online_at: new Date().toISOString(),
        });
      }
    });

    return this.localStream;
  }

  private async createPeerConnection(remoteUserId: string, isInitiator: boolean) {
    console.log(`Creating peer connection with ${remoteUserId}, initiator: ${isInitiator}`);

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(remoteUserId, peerConnection);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      console.log("Received remote track from:", remoteUserId);
      if (event.streams && event.streams[0]) {
        this.onStreamAdded?.(remoteUserId, event.streams[0]);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to:", remoteUserId);
        this.channel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            from: this.userId,
            to: remoteUserId,
            candidate: event.candidate,
          },
        });
      }
    };

    // Handle connection state
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUserId}:`, peerConnection.connectionState);
    };

    // Create offer if initiator
    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      console.log("Sending offer to:", remoteUserId);
      this.channel.send({
        type: "broadcast",
        event: "offer",
        payload: {
          from: this.userId,
          to: remoteUserId,
          offer: offer,
        },
      });
    }
  }

  private async handleOffer(remoteUserId: string, offer: RTCSessionDescriptionInit) {
    let peerConnection = this.peers.get(remoteUserId);
    
    if (!peerConnection) {
      await this.createPeerConnection(remoteUserId, false);
      peerConnection = this.peers.get(remoteUserId);
    }

    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log("Sending answer to:", remoteUserId);
      this.channel.send({
        type: "broadcast",
        event: "answer",
        payload: {
          from: this.userId,
          to: remoteUserId,
          answer: answer,
        },
      });
    }
  }

  private async handleAnswer(remoteUserId: string, answer: RTCSessionDescriptionInit) {
    const peerConnection = this.peers.get(remoteUserId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(remoteUserId: string, candidate: RTCIceCandidateInit) {
    const peerConnection = this.peers.get(remoteUserId);
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private removePeer(userId: string) {
    const peerConnection = this.peers.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peers.delete(userId);
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async cleanup() {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    // Close all peer connections
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();

    // Unsubscribe from channel
    if (this.channel) {
      await this.channel.untrack();
      await supabase.removeChannel(this.channel);
    }
  }
}
