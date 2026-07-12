-- Migration: Recreate questions table with inline options and answers, drop separate answers table and junction table
-- Date: 2026-06-13

-- Enable pgvector if not enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Drop RLS policies on tables to be dropped/modified
DROP POLICY IF EXISTS "Allow authenticated users to read questions" ON public.questions;
DROP POLICY IF EXISTS "Allow admins and teachers to manage questions" ON public.questions;
DROP POLICY IF EXISTS "Allow authenticated users to read answers" ON public.answers;
DROP POLICY IF EXISTS "Allow admins and teachers to manage answers" ON public.answers;
DROP POLICY IF EXISTS "Allow authenticated users to read exam questions" ON public.exam_questions;
DROP POLICY IF EXISTS "Allow admins and teachers to manage exam questions" ON public.exam_questions;

-- Drop dependent tables
DROP TABLE IF EXISTS public.answers CASCADE;
DROP TABLE IF EXISTS public.exam_questions CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;

-- Create the new questions table
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  de_id text NOT NULL,
  so_cau integer NOT NULL,
  phan text NOT NULL DEFAULT 'I'::text,
  content text NOT NULL,
  options jsonb NULL,
  answer text NULL,
  image_url text NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  embedding public.vector NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_de_id_so_cau_phan_key UNIQUE (de_id, so_cau, phan)
) TABLESPACE pg_default;

-- Create indexes as requested
CREATE INDEX IF NOT EXISTS idx_questions_de_id ON public.questions USING btree (de_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_grade ON public.questions USING btree (((metadata ->> 'grade'::text))) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_chapter ON public.questions USING btree (((metadata ->> 'chapter'::text))) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions USING btree (((metadata ->> 'difficulty'::text))) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_metadata ON public.questions USING gin (metadata) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_content_fts ON public.questions USING gin (to_tsvector('simple'::regconfig, content)) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_dang_toan ON public.questions USING btree (((metadata ->> 'dang_toan'::text))) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_dang_difficulty ON public.questions USING btree (
  ((metadata ->> 'dang_toan'::text)),
  ((metadata ->> 'difficulty'::text))
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_questions_dang_type ON public.questions USING btree (
  ((metadata ->> 'dang_toan'::text)),
  ((metadata ->> 'type'::text))
) TABLESPACE pg_default;

-- Create updated_at column helper function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE
ON public.questions FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on questions table
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Re-create policies for questions
CREATE POLICY "Allow authenticated users to read questions"
  ON public.questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow admins and teachers to manage questions"
  ON public.questions FOR ALL
  USING (public.is_teacher_or_admin());
