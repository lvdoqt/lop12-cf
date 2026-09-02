-- Admin-created tasks and timetable images shown to signed-in teachers.
CREATE TABLE IF NOT EXISTS public.teacher_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('task', 'timetable')),
  title text NOT NULL,
  content text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  due_at timestamptz,
  image_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_notices_published_created
  ON public.teacher_notices (is_published, created_at DESC);

ALTER TABLE public.teacher_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_read_published_notices"
  ON public.teacher_notices FOR SELECT
  USING (is_published = true AND public.is_teacher_or_admin());

CREATE POLICY "admins_manage_teacher_notices"
  ON public.teacher_notices FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
