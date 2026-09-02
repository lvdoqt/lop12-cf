-- ============================================================
-- Migration: Interactive Video Quizzes
-- Adds quiz questions tied to video timestamps + response log
-- ============================================================

-- Table 1: quiz questions attached to course_lessons at specific video timestamps
CREATE TABLE IF NOT EXISTS course_lesson_quizzes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       uuid NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  timestamp_sec   integer NOT NULL CHECK (timestamp_sec >= 0),  -- second in video to pause
  question        text NOT NULL,
  options         jsonb NOT NULL,   -- ["A. ...", "B. ...", "C. ...", "D. ..."]
  answer          text NOT NULL,    -- correct option letter: "A", "B", "C", or "D"
  explanation     text,             -- shown after student answers
  order_index     integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clq_lesson_id ON course_lesson_quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_clq_order ON course_lesson_quizzes(lesson_id, order_index);

-- Table 2: student answers to video quizzes (one row per attempt)
CREATE TABLE IF NOT EXISTS video_quiz_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES course_lesson_quizzes(id) ON DELETE CASCADE,
  lesson_id       uuid NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL for guest/học thử
  guest_id        text,             -- browser-generated ID for unauthenticated users
  selected_answer text NOT NULL,    -- "A", "B", "C", or "D"
  is_correct      boolean NOT NULL,
  attempt_number  integer NOT NULL DEFAULT 1,
  answered_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vqr_quiz_id ON video_quiz_responses(quiz_id);
CREATE INDEX IF NOT EXISTS idx_vqr_user_id ON video_quiz_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_vqr_lesson_id ON video_quiz_responses(lesson_id);

-- RLS: quizzes are public readable, only admin/teacher can write
ALTER TABLE course_lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_quiz_responses  ENABLE ROW LEVEL SECURITY;

-- Anyone can read quizzes (needed for học thử users)
CREATE POLICY "public_read_quizzes"
  ON course_lesson_quizzes FOR SELECT USING (true);

-- Only admin/teacher can manage quizzes
CREATE POLICY "teacher_manage_quizzes"
  ON course_lesson_quizzes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Anyone can insert their own response (including anonymous via guest_id)
CREATE POLICY "anyone_insert_response"
  ON video_quiz_responses FOR INSERT WITH CHECK (true);

-- Users can read their own responses; teachers/admins can read all
CREATE POLICY "read_own_responses"
  ON video_quiz_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );
