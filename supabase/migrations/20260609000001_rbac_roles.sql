-- Migration: Add created_by to exams, blogs and create comments table
-- Purpose: Support teacher-owned content (exams, blogs) and student comments

-- Add created_by to exams (references auth.users)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- Add created_by to blogs
ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- Update existing RLS policies for exams to respect created_by
DROP POLICY IF EXISTS "Allow admins and teachers to manage exams" ON public.exams;

CREATE POLICY "Allow admins full control on exams"
  ON public.exams FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow teachers to manage their own exams"
  ON public.exams FOR ALL
  USING (
    public.is_teacher_or_admin() AND
    (created_by = auth.uid() OR public.is_admin())
  )
  WITH CHECK (
    public.is_teacher_or_admin() AND
    created_by = auth.uid()
  );

-- Update existing RLS policies for blogs to respect created_by
DROP POLICY IF EXISTS "Allow admins and teachers to manage blogs" ON public.blogs;

CREATE POLICY "Allow admins full control on blogs"
  ON public.blogs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow teachers to manage their own blogs"
  ON public.blogs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    ) AND
    (created_by = auth.uid() OR public.is_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    ) AND
    created_by = auth.uid()
  );

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Allow anyone to read comments"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow admins to manage all comments"
  ON public.comments FOR ALL
  USING (public.is_admin());
