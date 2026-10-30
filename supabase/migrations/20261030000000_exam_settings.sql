-- Add settings JSONB column to exams table
-- Used for per-exam configuration such as pick_per_type (random question pool selection)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT NULL;

COMMENT ON COLUMN public.exams.settings IS
  'Optional exam configuration. Currently supports:
   pick_per_type: { "read": k, "cloze_text": k, "mcq": k, ... }
   — each student randomly receives k questions out of the n stored for that type.
   Omit a type key to include all questions of that type.';

