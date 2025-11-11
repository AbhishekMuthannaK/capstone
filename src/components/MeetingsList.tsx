import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Video, Trash2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  is_confidential: boolean;
  meeting_link: string | null;
}

interface MeetingsListProps {
  userId?: string;
  onMeetingsChange?: (count: number) => void;
}

const MeetingsList = ({ userId, onMeetingsChange }: MeetingsListProps) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      loadMeetings();
    }
  }, [userId]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("scheduled_start", { ascending: true });

      if (error) throw error;
      setMeetings(data || []);
      onMeetingsChange?.(data?.length || 0);
    } catch (error: any) {
      console.error("Error loading meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", meetingId);

      if (error) throw error;

      toast({
        title: "Meeting deleted",
        description: "The meeting has been removed successfully.",
      });

      loadMeetings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async (meetingLink: string, meetingId: string) => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopiedId(meetingId);
      toast({
        title: "Link copied",
        description: "Meeting link copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleJoinMeeting = (meetingId: string) => {
    navigate(`/meeting/${meetingId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-primary/10 text-primary";
      case "ongoing":
        return "bg-secondary/10 text-secondary";
      case "completed":
        return "bg-muted text-muted-foreground";
      case "cancelled":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading meetings...</p>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No meetings yet</h3>
        <p className="text-muted-foreground">
          Click "Schedule Meeting" to create your first secure video conference
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <div
          key={meeting.id}
          className="border border-border rounded-lg p-4 hover:shadow-soft transition-shadow bg-card"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground text-lg mb-1">
                {meeting.title}
              </h3>
              {meeting.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {meeting.description}
                </p>
              )}
            </div>
            <Badge className={getStatusColor(meeting.status)}>
              {meeting.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {format(new Date(meeting.scheduled_start), "MMM dd, yyyy")}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {format(new Date(meeting.scheduled_start), "hh:mm a")} -{" "}
              {format(new Date(meeting.scheduled_end), "hh:mm a")}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {meeting.is_confidential && (
                  <Badge variant="outline" className="text-xs">
                    Confidential
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {meeting.meeting_link && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(meeting.meeting_link!, meeting.id)}
                  >
                    {copiedId === meeting.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(meeting.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-primary hover:opacity-90"
                  onClick={() => handleJoinMeeting(meeting.id)}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Join
                </Button>
              </div>
            </div>
            
            {meeting.meeting_link && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {meeting.meeting_link}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MeetingsList;