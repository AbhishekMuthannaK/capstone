
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE IF NOT EXISTS app_user (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','faculty','hod','ministry')),
  department TEXT,
  phone TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user(role);

-- Meetings
CREATE TABLE IF NOT EXISTS meeting (
  meeting_id UUID PRIMARY KEY,
  meeting_code UUID NOT NULL UNIQUE,
  organizer_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','department','organization')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_organizer ON meeting(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_schedule ON meeting(scheduled_start, scheduled_end);

-- Participants (many-to-many)
CREATE TABLE IF NOT EXISTS meeting_participant (
  meeting_id UUID NOT NULL REFERENCES meeting(meeting_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('host','co_host','attendee')),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_participant_user ON meeting_participant(user_id);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_message (
  message_id BIGSERIAL PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meeting(meeting_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_meeting_created ON chat_message(meeting_id, created_at);

-- Shared files
CREATE TABLE IF NOT EXISTS shared_file (
  file_id BIGSERIAL PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meeting(meeting_id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- stored server-side name
  mime_type TEXT,
  size_bytes BIGINT,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shared_file_meeting ON shared_file(meeting_id);

-- Meeting recordings
CREATE TABLE IF NOT EXISTS meeting_recording (
  recording_id BIGSERIAL PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meeting(meeting_id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL, -- e.g., S3/GCS URL (signed when accessed)
  duration_seconds INTEGER,
  transcript TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recording_meeting ON meeting_recording(meeting_id);

-- Notifications (email/SMS reminders)
CREATE TABLE IF NOT EXISTS notification (
  notification_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meeting(meeting_id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  template TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_scheduled ON notification(status, scheduled_for);

-- Access tokens (optional, for OAuth2 or refresh management)
CREATE TABLE IF NOT EXISTS refresh_token (
  token_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_token(user_id, revoked);

-- Auditing
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Trigger to auto-update updated_at columns
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_updated ON app_user;
CREATE TRIGGER trg_user_updated BEFORE UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_meeting_updated ON meeting;
CREATE TRIGGER trg_meeting_updated BEFORE UPDATE ON meeting
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


