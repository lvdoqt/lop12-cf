-- Migration: Hệ thống Nộp bài tập (/nop-bai)
-- Lưu thông tin học sinh, lớp học, nội dung bài làm, ảnh đính kèm và số lần nộp

-- 1. Bảng lưu bài nộp của học sinh
CREATE TABLE IF NOT EXISTS public.nop_bai_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  class_id UUID,
  content TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_count INTEGER NOT NULL DEFAULT 1,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index tối ưu truy vấn theo học sinh & lớp để đếm số lần nộp và lọc danh sách
CREATE INDEX IF NOT EXISTS idx_nop_bai_student_class ON public.nop_bai_submissions(student_name, class_name);
CREATE INDEX IF NOT EXISTS idx_nop_bai_class_created ON public.nop_bai_submissions(class_name, created_at DESC);

-- Bật RLS
ALTER TABLE public.nop_bai_submissions ENABLE ROW LEVEL SECURITY;

-- Cho phép học sinh gửi bài công khai (kể cả chưa đăng nhập)
DROP POLICY IF EXISTS "Public can submit assignments" ON public.nop_bai_submissions;
CREATE POLICY "Public can submit assignments" ON public.nop_bai_submissions
  FOR INSERT TO public WITH CHECK (true);

-- Cho phép xem bài nộp
DROP POLICY IF EXISTS "Anyone can view submissions" ON public.nop_bai_submissions;
CREATE POLICY "Anyone can view submissions" ON public.nop_bai_submissions
  FOR SELECT TO public USING (true);

-- Giáo viên và admin có quyền xóa hoặc cập nhật bài nộp
DROP POLICY IF EXISTS "Teachers and admins can delete submissions" ON public.nop_bai_submissions;
CREATE POLICY "Teachers and admins can delete submissions" ON public.nop_bai_submissions
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('teacher', 'admin'))
  );

-- 2. Storage Bucket cho ảnh bài nộp
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nop-bai',
  'nop-bai',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
DROP POLICY IF EXISTS "Nop bai images public read" ON storage.objects;
CREATE POLICY "Nop bai images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'nop-bai');

DROP POLICY IF EXISTS "Nop bai images public insert" ON storage.objects;
CREATE POLICY "Nop bai images public insert" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'nop-bai');
