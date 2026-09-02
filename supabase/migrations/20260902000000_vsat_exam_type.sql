-- Add V-SAT as a first-class exam type.
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN ('15m', '45m', 'semester', 'mock_thpt', 'vsat'));

-- Everything required by V-SAT is stored in existing JSONB metadata; these
-- indexes make listing V-SAT exams and filtering its question types efficient.
CREATE INDEX IF NOT EXISTS idx_exams_exam_type ON public.exams (exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_vsat_type ON public.questions ((metadata ->> 'type'));

COMMENT ON CONSTRAINT exams_exam_type_check ON public.exams IS
  'Supported exam families, including computer-based V-SAT.';

-- V-SAT keeps the official 0–150 raw score separately from legacy score/10.
-- Ability score requires calibrated IRT item parameters and is therefore nullable.
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS raw_score numeric(6,2);
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS ability_score numeric(7,2);
CREATE INDEX IF NOT EXISTS idx_attempts_vsat_raw_score
  ON public.attempts (raw_score) WHERE raw_score IS NOT NULL;
COMMENT ON COLUMN public.attempts.raw_score IS 'Official V-SAT raw score, maximum 150.';
COMMENT ON COLUMN public.attempts.ability_score IS 'IRT scaled score (mean 500, SD 100); null until calibrated by an IRT model.';
