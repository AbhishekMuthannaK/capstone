import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { WebRTCManager, Participant } from "@/utils/webrtc";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Users,  Check,
  Settings
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  is_confidential: boolean;
}

const Meeting = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [hasJoined, setHasJoined] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const init = async () => {
      if (meetingId) {
        await loadMeeting();
        await loadCurrentUser();
      }
    };
    init();

    // Cleanup on unmount
    return () => {
      webrtcManagerRef.current?.cleanup();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [meetingId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const loadMeeting = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .single();

      if (error) throw error;
      setMeeting(data);
    } catch (error: any) {
      console.error("Error loading meeting:", error);
      toast({
        title: "Error",
        description: "Failed to load meeting details",
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const getLocalStream = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideo = devices.some(device => device.kind === 'videoinput');
    const hasAudio = devices.some(device => device.kind === 'audioinput');

    let videoStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;

    try {
      if (hasVideo) {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 15 },
            timeout: 5000 // 5 seconds timeout
          }
        });
      }
      if (hasAudio) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // You can add more specific audio constraints here if needed
            // e.g., sampleRate: { ideal: 48000 },
            // channelCount: { ideal: 2 },
            timeout: 5000 // 5 seconds timeout
          }
        });
      }

      if (!videoStream && !audioStream) {
        throw new Error("No media devices found.");
      }

      const combinedStream = new MediaStream();
      videoStream?.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      audioStream?.getAudioTracks().forEach(track => combinedStream.addTrack(track));

      setLocalStream(combinedStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = combinedStream;
      }

      setIsVideoOn(hasVideo);
      setIsAudioOn(hasAudio);

      combinedStream.getVideoTracks().forEach(track => track.enabled = hasVideo);
      combinedStream.getAudioTracks().forEach(track => track.enabled = hasAudio);

    } catch (error) {
      console.error("Error getting user media:", error);
      let description = "An unknown error occurred while accessing your media devices.";
      if (error instanceof Error) {
        if (error.name === "NotFoundError") {
          if (!hasVideo && !hasAudio) {
            description = "No camera or microphone found. Please connect a device to join.";
          } else if (!hasVideo) {
            description = "No camera found. You can join with audio only.";
          } else if (!hasAudio) {
            description = "No microphone found. You can join with video only.";
          } 
        } else if (error.name === "NotReadableError") {
          description = "Your camera or microphone might be in use by another application, or there's a hardware issue. Please close other apps or restart your device.";
        } else if (error.name === "AbortError") {
          description = "Access to your camera or microphone timed out. Please ensure your devices are connected and try again, or restart your browser.";
        } else if (error.name === "NotAllowedError" || error.name === "SecurityError") {
          description = "Permission to access your camera or microphone was denied. Please grant permissions in your browser settings.";
        } else if (error.name === "OverconstrainedError") {
          description = "Your device does not support the requested camera/microphone settings. Try with default settings.";
        }
      }
      toast({
        title: "Media Access Error",
        description,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!hasJoined && !loading) {
      getLocalStream();
    }
  }, [loading, hasJoined]);

  const initializeWebRTC = async () => {
    if (!currentUser || !meetingId || !localStream) return;

    try {
      const manager = new WebRTCManager(
        meetingId,
        currentUser.id,
        currentUser.full_name || "User",
        {
          onParticipantJoined: (participant) => {
            console.log("Participant joined:", participant);
            setParticipants((prev) => new Map(prev).set(participant.userId, participant));
          },
          onParticipantLeft: (userId) => {
            console.log("Participant left:", userId);
            setParticipants((prev) => {
              const updated = new Map(prev);
              updated.delete(userId);
              return updated;
            });
            remoteVideoRefs.current.delete(userId);
          },
          onStreamAdded: (userId, stream) => {
            console.log("Stream added for participant:", userId);
            setParticipants((prev) => {
              const updated = new Map(prev);
              const participant = updated.get(userId);
              if (participant) {
                participant.stream = stream;
                updated.set(userId, participant);
              }
              return updated;
            });
            
            // Attach stream to video element
            const videoElement = remoteVideoRefs.current.get(userId);
            if (videoElement) {
              videoElement.srcObject = stream;
            }
          },
        }
      );

      await manager.initialize(localStream);
      webrtcManagerRef.current = manager;

      toast({
        title: "Connected",
        description: "You've joined the meeting",
      });
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
      toast({
        title: "Media Access Error",
        description: "Could not access camera or microphone",
        variant: "destructive",
      });
    }
  };

  const toggleVideo = () => {
    const newState = !isVideoOn;
    setIsVideoOn(newState);
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = newState;
    }
    webrtcManagerRef.current?.toggleVideo(newState);
  };

  const toggleAudio = () => {
    const newState = !isAudioOn;
    setIsAudioOn(newState);
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = newState;
    }
    webrtcManagerRef.current?.toggleAudio(newState);
  };

  const handleEndCall = async () => {
    if (webrtcManagerRef.current) {
      await webrtcManagerRef.current.cleanup();
    }
    navigate("/dashboard");
  };

  const handleJoinMeeting = async () => {
    if (!localStream) {
      return getLocalStream();
    }
    await initializeWebRTC();
    setHasJoined(true);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-lg p-8 text-center shadow-large border-border">
          <h1 className="text-2xl font-bold text-foreground mb-2">{meeting?.title}</h1>
          <p className="text-muted-foreground mb-6">{meeting?.description}</p>
          
          <div className="relative aspect-video bg-black rounded-lg mb-6 overflow-hidden">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute bottom-4 flex gap-3">
                <Button variant={isAudioOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full" onClick={toggleAudio}>
                  {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button variant={isVideoOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full" onClick={toggleVideo}>
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-left mb-6">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-primary" />
              <p className="text-muted-foreground">Your camera and mic will be on when you join.</p>
            </div>
             <div className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-primary" />
              <p className="text-muted-foreground">Other participants will be able to see and hear you.</p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            onClick={handleJoinMeeting}
          >
            Join now
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full mt-3"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }


  const participantArray = Array.from(participants.values());
  const totalParticipants = participantArray.length + 1; // +1 for current user

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{meeting?.title}</h1>
            <p className="text-xs text-muted-foreground">
              {meeting?.is_confidential && "🔒 Confidential Meeting"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{totalParticipants}</span>
          </div>
        </div>
      </header>

      {/* Main Meeting Area */}
      <main className="container mx-auto px-4 py-6">
        {/* Video Grid */}
        <div className="mb-6">
          <div className={`grid gap-4 ${totalParticipants === 1 ? 'grid-cols-1' : totalParticipants === 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {/* Local Video */}
            <Card className="relative overflow-hidden bg-black aspect-video shadow-medium">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-primary">
                  <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">
                      {currentUser?.full_name?.charAt(0) || "Y"}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-white text-sm">You {!isAudioOn && "🔇"}</span>
              </div>
            </Card>

            {/* Remote Videos */}
            {participantArray.map((participant) => (
              <Card key={participant.userId} className="relative overflow-hidden bg-black aspect-video shadow-medium">
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(participant.userId, el);
                      if (participant.stream) {
                        el.srcObject = participant.stream;
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!participant.stream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-primary">
                    <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center">
                      <span className="text-2xl font-bold text-foreground">
                        {participant.userName?.charAt(0) || "U"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-white text-sm">{participant.userName}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isAudioOn ? "outline" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={toggleAudio}
          >
            {isAudioOn ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant={isVideoOn ? "outline" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={toggleVideo}
          >
            {isVideoOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14 bg-destructive hover:bg-destructive/90"
            onClick={handleEndCall}
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full w-14 h-14"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Participants List */}
        <Card className="mt-6 p-4 shadow-soft max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Participants ({totalParticipants})</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {currentUser?.full_name?.charAt(0) || "Y"}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">You (Host)</p>
              </div>
              <div className="flex gap-1">
                {isAudioOn ? (
                  <Mic className="w-4 h-4 text-primary" />
                ) : (
                  <MicOff className="w-4 h-4 text-destructive" />
                )}
              </div>
            </div>
            {participantArray.map((participant) => (
              <div key={participant.userId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {participant.userName?.charAt(0) || "U"}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{participant.userName}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Meeting;
