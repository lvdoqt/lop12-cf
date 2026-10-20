-- Migration: Bổ sung tài liệu (Word, PPT, PDF, Google Drive) và Video YouTube vào bài giao lớp học
-- Kèm theo bảng ghi nhận lượt xem (document_views, youtube_views) phục vụ báo cáo
-- Created: 2026-10-18

-- 1. Cập nhật bảng class_assignments
ALTER TABLE public.class_assignments
  DROP CONSTRAINT IF EXISTS class_assignments_type_check;

ALTER TABLE public.class_assignments
  ADD CONSTRAINT class_assignments_type_check
  CHECK (type IN ('course', 'exam', 'material'));

ALTER TABLE public.class_assignments
  ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT DEFAULT NULL;

-- 2. Tạo bảng class_assignment_views ghi nhận lượt xem của học sinh
CREATE TABLE IF NOT EXISTS public.class_assignment_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_views INT NOT NULL DEFAULT 0,
  youtube_views INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(assignment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_assignment_views_assignment ON public.class_assignment_views(assignment_id);
CREATE INDEX IF NOT EXISTS idx_class_assignment_views_user ON public.class_assignment_views(user_id);

ALTER TABLE public.class_assignment_views ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Authenticated view assignment views" ON public.class_assignment_views
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert/update own assignment views" ON public.class_assignment_views
  FOR ALL TO authenticated USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );
