-- Migration: Add exam_rooms, room_participants, polls for live classroom features
-- Created At: 2026-09-26

-- 1. EXAM ROOMS (Phòng thi trực tuyến của giáo viên)
CREATE TABLE IF NOT EXISTS public.exam_rooms (
  id TEXT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_title TEXT NOT NULL,
  exam_duration INTEGER NOT NULL DEFAULT 90,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_rooms_code ON public.exam_rooms(code);
CREATE INDEX IF NOT EXISTS idx_exam_rooms_teacher ON public.exam_rooms(teacher_id);

-- 2. ROOM PARTICIPANTS (Học sinh tham gia phòng thi trực tuyến)
CREATE TABLE IF NOT EXISTS public.room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.exam_rooms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  submitted_at TIMESTAMPTZ,
  score NUMERIC(5, 2),
  total_questions INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);

-- 3. POLLS (Khảo sát nhanh trong giờ học của giáo viên)
CREATE TABLE IF NOT EXISTS public.polls (
  id TEXT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_polls_code ON public.polls(code);

-- 4. POLL VOTES (Bình chọn khảo sát)
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  voter_name TEXT,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes(poll_id);

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE public.exam_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- exam_rooms: Public can read active/waiting rooms by code; Teachers can manage their rooms
CREATE POLICY "Public read exam rooms" ON public.exam_rooms
  FOR SELECT USING (true);

CREATE POLICY "Teachers can insert their exam rooms" ON public.exam_rooms
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their exam rooms" ON public.exam_rooms
  FOR UPDATE USING (auth.uid() = teacher_id);

-- room_participants: Public can insert (join) and read participants of a room
CREATE POLICY "Public can join and view room participants" ON public.room_participants
  FOR ALL USING (true);

-- polls: Public can read polls; Teachers manage their polls
CREATE POLICY "Public read polls" ON public.polls
  FOR SELECT USING (true);

CREATE POLICY "Teachers can manage their polls" ON public.polls
  FOR ALL USING (auth.uid() = teacher_id);

-- poll_votes: Public can vote and view votes
CREATE POLICY "Public can vote in polls" ON public.poll_votes
  FOR ALL USING (true);
