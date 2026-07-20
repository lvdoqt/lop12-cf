-- Migration: Add exam_questions junction table
-- Date: 2026-07-19
-- Purpose: Fix duplicate question rows. Previously createExam() cloned each bank question
-- into a new row with de_id=exam_id. Now exams reference bank questions via this table.

-- Create junction table
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  so_cau      integer NOT NULL DEFAULT 1,
  phan        text    NOT NULL DEFAULT 'I',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_questions_exam_question_unique UNIQUE (exam_id, question_id)
);

-- Enable RLS
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

-- Service role full access (used by SSR admin client)
CREATE POLICY "Service role full access on exam_questions"
  ON public.exam_questions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read (for taking exams)
CREATE POLICY "Authenticated users read exam_questions"
  ON public.exam_questions FOR SELECT
  TO authenticated
  USING (true);

-- Teachers and admins can manage
CREATE POLICY "Teachers and admins manage exam_questions"
  ON public.exam_questions FOR ALL
  USING (public.is_teacher_or_admin());

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id     ON public.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_question_id ON public.exam_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_so_cau      ON public.exam_questions(exam_id, so_cau);

-- ============================================================
-- Migrate existing data (clone rows with de_id=exam_uuid)
-- into exam_questions where parent_id metadata is available
-- ============================================================
INSERT INTO public.exam_questions (exam_id, question_id, so_cau, phan)
SELECT
  q.de_id::uuid,
  (q.metadata->>'parent_id')::uuid,
  q.so_cau,
  q.phan
FROM public.questions q
JOIN public.exams e ON e.id::text = q.de_id
WHERE q.de_id != 'bank'
  AND q.metadata->>'parent_id' IS NOT NULL
  AND (q.metadata->>'parent_id')::uuid IN (SELECT id FROM public.questions WHERE de_id = 'bank')
ON CONFLICT (exam_id, question_id) DO NOTHING;

-- Remove cloned question rows (de_id = exam uuid) — they are now replaced by exam_questions
DELETE FROM public.questions WHERE de_id != 'bank';

-- Note: questions.de_id column is kept as-is (value 'bank') for all bank questions.
-- The UNIQUE constraint (de_id, so_cau, phan) remains valid for bank questions.
