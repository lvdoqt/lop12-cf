-- Khóa học
CREATE TABLE IF NOT EXISTS public.courses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  slug         TEXT UNIQUE NOT NULL,
  subject_id   TEXT,
  cover_url    TEXT,
  is_published BOOLEAN DEFAULT false,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Bài giảng trong khóa học
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id    UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT,
  video_url    TEXT,
  order_index  INTEGER DEFAULT 0,
  duration     INTEGER,
  is_published BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Đăng ký học
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, user_id)
);

-- Tiến độ học sinh
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id    UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  completed    BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(lesson_id, user_id)
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COURSES
-- ============================================================
-- Student & guest: thấy khóa học đã xuất bản
-- Teacher: thấy khóa học của mình + khóa học published
-- Admin: thấy tất cả
DROP POLICY IF EXISTS "Courses select" ON public.courses;
CREATE POLICY "Courses select" ON public.courses FOR SELECT
  USING (
    is_published = true
    OR auth.uid() = created_by
    OR public.is_admin()
  );

-- Teacher tạo khóa học, admin tạo bất kỳ
DROP POLICY IF EXISTS "Courses insert" ON public.courses;
CREATE POLICY "Courses insert" ON public.courses FOR INSERT
  WITH CHECK (public.is_teacher_or_admin());

-- Teacher sửa/xóa khóa học của mình, admin sửa/xóa tất cả
DROP POLICY IF EXISTS "Courses update" ON public.courses;
CREATE POLICY "Courses update" ON public.courses FOR UPDATE
  USING (auth.uid() = created_by OR public.is_admin());

DROP POLICY IF EXISTS "Courses delete" ON public.courses;
CREATE POLICY "Courses delete" ON public.courses FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());

-- ============================================================
-- COURSE LESSONS
-- ============================================================
-- Ai thấy được course thì thấy lesson của course đó
DROP POLICY IF EXISTS "Course lessons select" ON public.course_lessons;
CREATE POLICY "Course lessons select" ON public.course_lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = course_id
        AND (is_published = true OR created_by = auth.uid() OR public.is_admin())
    )
  );

-- Teacher tạo lesson trong course của mình, admin tạo bất kỳ
DROP POLICY IF EXISTS "Course lessons insert" ON public.course_lessons;
CREATE POLICY "Course lessons insert" ON public.course_lessons FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_teacher_or_admin()
      AND EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = course_id AND created_by = auth.uid()
      )
    )
  );

-- Teacher sửa/xóa lesson trong course của mình, admin sửa/xóa tất cả
DROP POLICY IF EXISTS "Course lessons update" ON public.course_lessons;
CREATE POLICY "Course lessons update" ON public.course_lessons FOR UPDATE
  USING (
    public.is_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = course_id AND created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Course lessons delete" ON public.course_lessons;
CREATE POLICY "Course lessons delete" ON public.course_lessons FOR DELETE
  USING (
    public.is_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = course_id AND created_by = auth.uid()
      )
    )
  );

-- ============================================================
-- COURSE ENROLLMENTS
-- ============================================================
-- Học sinh xem đăng ký của mình, teacher xem học sinh trong course mình dạy, admin xem tất cả
DROP POLICY IF EXISTS "Enrollments select" ON public.course_enrollments;
CREATE POLICY "Enrollments select" ON public.course_enrollments FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_teacher_or_admin()
      AND EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = course_id AND created_by = auth.uid()
      )
    )
  );

-- Học sinh tự đăng ký, admin ghi danh bất kỳ
DROP POLICY IF EXISTS "Enrollments insert" ON public.course_enrollments;
CREATE POLICY "Enrollments insert" ON public.course_enrollments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin()
  );

-- Học sinh tự hủy đăng ký, admin xóa bất kỳ
DROP POLICY IF EXISTS "Enrollments delete" ON public.course_enrollments;
CREATE POLICY "Enrollments delete" ON public.course_enrollments FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

-- ============================================================
-- LESSON PROGRESS
-- ============================================================
-- Học sinh xem tiến độ của mình, teacher xem tiến độ học sinh trong course mình dạy, admin xem tất cả
DROP POLICY IF EXISTS "Progress select" ON public.lesson_progress;
CREATE POLICY "Progress select" ON public.lesson_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_teacher_or_admin()
      AND EXISTS (
        SELECT 1 FROM public.course_lessons cl
        JOIN public.courses c ON c.id = cl.course_id
        WHERE cl.id = lesson_id AND c.created_by = auth.uid()
      )
    )
  );

-- Học sinh ghi tiến độ của mình (upsert)
DROP POLICY IF EXISTS "Progress insert" ON public.lesson_progress;
CREATE POLICY "Progress insert" ON public.lesson_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Progress update" ON public.lesson_progress;
CREATE POLICY "Progress update" ON public.lesson_progress FOR UPDATE
  USING (user_id = auth.uid());

-- Thêm 6 môn còn thiếu (chỉ có trong mock data)
INSERT INTO public.subjects (name, slug) VALUES
  ('Ngữ Văn 12', 'ngu-van-12'),
  ('Lịch Sử 12', 'lich-su-12'),
  ('Địa Lý 12', 'dia-ly-12'),
  ('KTPL 12', 'ktpl-12'),
  ('Tin Học 12', 'tin-hoc-12'),
  ('Công Nghệ 12', 'cong-nghe-12')
ON CONFLICT (slug) DO NOTHING;
