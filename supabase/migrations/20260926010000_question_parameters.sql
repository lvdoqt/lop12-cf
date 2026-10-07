-- Migration: Question parameters for Item Response Theory (IRT)
-- Stores difficulty (b parameter), discrimination (a parameter), and guessing (c parameter)
CREATE TABLE IF NOT EXISTS public.question_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL,
  difficulty_b numeric(5, 3) NOT NULL DEFAULT 0.000, -- b parameter: typically -3.0 to +3.0
  discrimination_a numeric(5, 3) NOT NULL DEFAULT 1.000, -- a parameter (1.0 in Rasch model)
  guessing_c numeric(5, 3) NOT NULL DEFAULT 0.000, -- c parameter (pseudo-guessing)
  sample_size integer NOT NULL DEFAULT 0,
  calibrated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_question_param_id FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_params_qid ON public.question_parameters(question_id);
CREATE INDEX IF NOT EXISTS idx_question_params_diff ON public.question_parameters(difficulty_b);

-- Enable RLS
ALTER TABLE public.question_parameters ENABLE ROW LEVEL SECURITY;

-- Allow public read of item parameters
CREATE POLICY "Public read question parameters"
  ON public.question_parameters FOR SELECT
  USING (true);

-- Allow teachers and admins to insert/update question parameters
CREATE POLICY "Teachers and admins manage question parameters"
  ON public.question_parameters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
    )
  );
