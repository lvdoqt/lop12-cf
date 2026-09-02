-- LOP 12 LMS - V-SAT SETUP / UPGRADE
-- Run this whole file in Supabase Dashboard -> SQL Editor.
-- Prerequisite: public.exams, public.questions and public.attempts exist.
-- Safe to run again.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.exams') IS NULL
     OR to_regclass('public.questions') IS NULL
     OR to_regclass('public.attempts') IS NULL THEN
    RAISE EXCEPTION 'Missing LMS tables. Run the base files in supabase/migrations first.';
  END IF;
END $$;

ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN ('15m', '45m', 'semester', 'mock_thpt', 'vsat'));

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS raw_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS ability_score numeric(7,2);

CREATE INDEX IF NOT EXISTS idx_exams_exam_type ON public.exams (exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_vsat_type ON public.questions ((metadata ->> 'type'));
CREATE INDEX IF NOT EXISTS idx_attempts_vsat_raw_score
  ON public.attempts (raw_score) WHERE raw_score IS NOT NULL;

COMMENT ON CONSTRAINT exams_exam_type_check ON public.exams IS
  'Supported exam families, including computer-based V-SAT.';
COMMENT ON COLUMN public.attempts.raw_score IS
  'Official V-SAT raw score, maximum 150.';
COMMENT ON COLUMN public.attempts.ability_score IS
  'IRT scaled score (mean 500, SD 100); null until calibrated by an IRT model.';

COMMIT;

SELECT
  'vsat' AS enabled_exam_type,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attempts' AND column_name='raw_score') AS has_raw_score,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attempts' AND column_name='ability_score') AS has_ability_score;
