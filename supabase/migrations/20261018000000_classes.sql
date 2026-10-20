-- Migration: Quản lý Lớp học (Classes) cho giáo viên
-- Created: 2026-10-18

-- ── 1. CLASSES — Lớp học ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  grade      TEXT NOT NULL DEFAULT '12',
  subject    TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '#6366f1',
  teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes(teacher_id);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Teacher/admin có thể đọc lớp của mình
CREATE POLICY "Teachers view own classes" ON public.classes
  FOR SELECT TO authenticated USING (
    teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Teacher/admin có thể tạo lớp
CREATE POLICY "Teachers insert classes" ON public.classes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

-- Chủ lớp hoặc admin sửa/xóa
CREATE POLICY "Owner or admin update classes" ON public.classes
  FOR UPDATE TO authenticated USING (
    auth.uid() = teacher_id
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "Owner or admin delete classes" ON public.classes
  FOR DELETE TO authenticated USING (
    auth.uid() = teacher_id
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ── 2. CLASS MEMBERS — Thành viên trong lớp ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id  UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);

ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- Authenticated users có thể xem thành viên lớp
CREATE POLICY "Authenticated view class members" ON public.class_members
  FOR SELECT TO authenticated USING (true);

-- Teacher/admin thêm thành viên
CREATE POLICY "Teachers insert class members" ON public.class_members
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

-- Teacher/admin xóa thành viên
CREATE POLICY "Teachers delete class members" ON public.class_members
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );

-- ── 3. CLASS ASSIGNMENTS — Bài tập được giao cho lớp ─────────────────────────
CREATE TABLE IF NOT EXISTS public.class_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('course', 'exam')),
  ref_id      TEXT NOT NULL,          -- course.id hoặc exam.id
  ref_title   TEXT NOT NULL DEFAULT '',  -- denormalized title
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  deadline    TIMESTAMPTZ,
  note        TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_class_assignments_class ON public.class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_ref ON public.class_assignments(ref_id);

ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

-- Authenticated users xem bài được giao
CREATE POLICY "Authenticated view class assignments" ON public.class_assignments
  FOR SELECT TO authenticated USING (true);

-- Teacher/admin giao bài
CREATE POLICY "Teachers insert assignments" ON public.class_assignments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

-- Teacher/admin xóa bài giao
CREATE POLICY "Teachers delete assignments" ON public.class_assignments
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND (
        c.teacher_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
    )
  );
