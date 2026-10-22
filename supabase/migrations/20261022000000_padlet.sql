-- Migration: Bảng tương tác Padlet (padlet_boards, padlet_notes, padlet_comments)
-- Created At: 2026-10-22
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. PADLET BOARDS (Bảng tương tác của giáo viên)
CREATE TABLE IF NOT EXISTS public.padlet_boards (
  id TEXT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  theme VARCHAR(30) NOT NULL DEFAULT 'corkboard',
  layout_mode VARCHAR(20) NOT NULL DEFAULT 'wall' CHECK (layout_mode IN ('wall', 'columns')),
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  allow_comments BOOLEAN NOT NULL DEFAULT true,
  allow_likes BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_padlet_boards_code ON public.padlet_boards(code);
CREATE INDEX IF NOT EXISTS idx_padlet_boards_created_by ON public.padlet_boards(created_by);
CREATE INDEX IF NOT EXISTS idx_padlet_boards_created_at ON public.padlet_boards(created_at DESC);

-- 2. PADLET NOTES (Ghi chú / Thẻ dán trên bảng tương tác)
CREATE TABLE IF NOT EXISTS public.padlet_notes (
  id TEXT PRIMARY KEY,
  board_code VARCHAR(10) NOT NULL REFERENCES public.padlet_boards(code) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Học sinh',
  title TEXT,
  content TEXT NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'blue', 'green', 'pink', 'purple', 'orange')),
  column_id TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_padlet_notes_board_code ON public.padlet_notes(board_code);
CREATE INDEX IF NOT EXISTS idx_padlet_notes_created_at ON public.padlet_notes(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_padlet_notes_is_pinned ON public.padlet_notes(is_pinned);

-- 3. PADLET COMMENTS (Bình luận dưới mỗi ghi chú)
CREATE TABLE IF NOT EXISTS public.padlet_comments (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES public.padlet_notes(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Học sinh',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_padlet_comments_note_id ON public.padlet_comments(note_id);
CREATE INDEX IF NOT EXISTS idx_padlet_comments_created_at ON public.padlet_comments(created_at ASC);

-- ── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────
ALTER TABLE public.padlet_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_comments ENABLE ROW LEVEL SECURITY;

-- padlet_boards: Công khai đọc; Insert/Update/Delete mở (SSR sử dụng Service Role Key)
DROP POLICY IF EXISTS "Public read padlet boards" ON public.padlet_boards;
CREATE POLICY "Public read padlet boards" ON public.padlet_boards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert padlet boards" ON public.padlet_boards;
CREATE POLICY "Allow insert padlet boards" ON public.padlet_boards
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update padlet boards" ON public.padlet_boards;
CREATE POLICY "Allow update padlet boards" ON public.padlet_boards
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete padlet boards" ON public.padlet_boards;
CREATE POLICY "Allow delete padlet boards" ON public.padlet_boards
  FOR DELETE USING (true);

-- padlet_notes: Học sinh và giáo viên đều có thể đọc, tạo ghi chú, sửa/ghim/xóa
DROP POLICY IF EXISTS "Public read padlet notes" ON public.padlet_notes;
CREATE POLICY "Public read padlet notes" ON public.padlet_notes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert padlet notes" ON public.padlet_notes;
CREATE POLICY "Public insert padlet notes" ON public.padlet_notes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update padlet notes" ON public.padlet_notes;
CREATE POLICY "Public update padlet notes" ON public.padlet_notes
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public delete padlet notes" ON public.padlet_notes;
CREATE POLICY "Public delete padlet notes" ON public.padlet_notes
  FOR DELETE USING (true);

-- padlet_comments: Đọc và gửi bình luận
DROP POLICY IF EXISTS "Public read padlet comments" ON public.padlet_comments;
CREATE POLICY "Public read padlet comments" ON public.padlet_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert padlet comments" ON public.padlet_comments;
CREATE POLICY "Public insert padlet comments" ON public.padlet_comments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update padlet comments" ON public.padlet_comments;
CREATE POLICY "Public update padlet comments" ON public.padlet_comments
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public delete padlet comments" ON public.padlet_comments;
CREATE POLICY "Public delete padlet comments" ON public.padlet_comments
  FOR DELETE USING (true);
