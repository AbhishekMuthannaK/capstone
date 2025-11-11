-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view meetings they are part of" ON public.meetings;
DROP POLICY IF EXISTS "Users can view participants of their meetings" ON public.meeting_participants;

-- Create a simpler, non-recursive policy for meetings
-- Users can view meetings where they are the host OR meetings that are not confidential
CREATE POLICY "Users can view their hosted meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Simplify meeting_participants policy to avoid recursion
CREATE POLICY "Users can view meeting participants"
ON public.meeting_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Allow hosts to manage participants
CREATE POLICY "Hosts can manage their meeting participants"
ON public.meeting_participants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = meeting_participants.meeting_id 
    AND meetings.host_id = auth.uid()
  ) OR 
  has_role(auth.uid(), 'admin'::app_role)
);