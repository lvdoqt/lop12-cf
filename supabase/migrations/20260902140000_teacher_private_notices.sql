-- Notices can be public to all teachers or private to one teacher.
ALTER TABLE public.teacher_notices
  ADD COLUMN IF NOT EXISTS recipient_teacher_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_teacher_notices_recipient_published_created
  ON public.teacher_notices (recipient_teacher_id, is_published, created_at DESC);

DROP POLICY IF EXISTS "teachers_read_published_notices" ON public.teacher_notices;
DROP POLICY IF EXISTS "admins_manage_teacher_notices" ON public.teacher_notices;

CREATE POLICY "teachers_read_global_notices"
  ON public.teacher_notices FOR SELECT
  USING (
    is_published = true
    AND recipient_teacher_id IS NULL
    AND public.is_teacher_or_admin()
  );

CREATE POLICY "teachers_manage_own_notices"
  ON public.teacher_notices FOR ALL
  USING (recipient_teacher_id = auth.uid() AND created_by = auth.uid())
  WITH CHECK (recipient_teacher_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "admins_manage_teacher_notices"
  ON public.teacher_notices FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
