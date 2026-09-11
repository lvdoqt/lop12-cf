-- ============================================================
-- Standalone end-of-lesson review quizzes (not video quizzes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.course_lesson_review_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2),
  answer text NOT NULL CHECK (answer ~ '^[A-H]$'),
  explanation text,
  knowledge_tag text NOT NULL DEFAULT 'Chưa phân loại',
  difficulty smallint NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  points numeric(8,2) NOT NULL DEFAULT 1 CHECK (points > 0),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_lesson_review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  score numeric(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
  correct_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  earned_points numeric(10,2) NOT NULL DEFAULT 0,
  total_points numeric(10,2) NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.course_lesson_review_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.course_lesson_review_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.course_lesson_review_questions(id) ON DELETE CASCADE,
  selected_answer text NOT NULL CHECK (selected_answer ~ '^[A-H]$'),
  is_correct boolean NOT NULL,
  awarded_points numeric(8,2) NOT NULL DEFAULT 0,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_review_questions_lesson ON public.course_lesson_review_questions(lesson_id, order_index);
CREATE INDEX IF NOT EXISTS idx_review_attempts_student ON public.course_lesson_review_attempts(user_id, lesson_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_answers_attempt ON public.course_lesson_review_answers(attempt_id);

ALTER TABLE public.course_lesson_review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_review_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_review_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Review questions visible with lesson"
  ON public.course_lesson_review_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.course_lessons cl
    JOIN public.courses c ON c.id = cl.course_id
    WHERE cl.id = lesson_id AND ((cl.is_published AND c.is_published) OR c.created_by = auth.uid() OR public.is_admin())
  ));

CREATE POLICY "Review attempts own or course teacher"
  ON public.course_lesson_review_attempts FOR SELECT
  USING (
    user_id = auth.uid() OR public.is_admin() OR EXISTS (
      SELECT 1 FROM public.course_lessons cl JOIN public.courses c ON c.id = cl.course_id
      WHERE cl.id = lesson_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Review answers own or course teacher"
  ON public.course_lesson_review_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.course_lesson_review_attempts a
    JOIN public.course_lessons cl ON cl.id = a.lesson_id
    JOIN public.courses c ON c.id = cl.course_id
    WHERE a.id = attempt_id AND (a.user_id = auth.uid() OR c.created_by = auth.uid() OR public.is_admin())
  ));

-- Browser roles can read question prompts but never answer/explanation columns.
REVOKE SELECT ON public.course_lesson_review_questions FROM anon, authenticated;
GRANT SELECT (id, lesson_id, question, options, knowledge_tag, difficulty, points, order_index, created_at)
  ON public.course_lesson_review_questions TO anon, authenticated;
GRANT SELECT ON public.course_lesson_review_questions TO service_role;
GRANT SELECT ON public.course_lesson_review_attempts, public.course_lesson_review_answers TO authenticated, service_role;

-- Atomic creation of a lesson and its independent review quiz.
CREATE OR REPLACE FUNCTION public.create_course_lesson_with_review_quiz(
  p_course_id uuid, p_title text, p_content text, p_video_url text,
  p_order_index integer, p_duration integer, p_is_published boolean,
  p_is_free boolean, p_questions jsonb DEFAULT '[]'::jsonb
)
RETURNS public.course_lessons
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  created_lesson public.course_lessons;
  item jsonb;
  item_options jsonb;
  item_answer text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server role required'; END IF;
  IF jsonb_typeof(COALESCE(p_questions, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Questions must be an array'; END IF;

  INSERT INTO public.course_lessons(course_id, title, content, video_url, order_index, duration, is_published, is_free)
  VALUES (p_course_id, trim(p_title), NULLIF(trim(p_content), ''), NULLIF(trim(p_video_url), ''),
    greatest(0, p_order_index), p_duration, p_is_published, p_is_free)
  RETURNING * INTO created_lesson;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb)) LOOP
    item_options := item->'options';
    item_answer := upper(trim(item->>'answer'));
    IF jsonb_typeof(item_options) <> 'array' OR jsonb_array_length(item_options) < 2 THEN
      RAISE EXCEPTION 'Every review question needs at least two options';
    END IF;
    IF item_answer IS NULL OR item_answer !~ '^[A-H]$'
       OR ascii(item_answer) - ascii('A') + 1 > jsonb_array_length(item_options) THEN
      RAISE EXCEPTION 'Review answer does not match an option';
    END IF;
    INSERT INTO public.course_lesson_review_questions(
      lesson_id, question, options, answer, explanation, knowledge_tag,
      difficulty, points, order_index
    ) VALUES (
      created_lesson.id, trim(item->>'question'), item_options, item_answer,
      NULLIF(trim(item->>'explanation'), ''),
      COALESCE(NULLIF(trim(item->>'knowledge_tag'), ''), 'Chưa phân loại'),
      greatest(1, least(COALESCE((item->>'difficulty')::integer, 2), 3)),
      greatest(0.01, COALESCE((item->>'points')::numeric, 1)),
      COALESCE((item->>'order_index')::integer, 0)
    );
  END LOOP;
  RETURN created_lesson;
END;
$$;

REVOKE ALL ON FUNCTION public.create_course_lesson_with_review_quiz(uuid,text,text,text,integer,integer,boolean,boolean,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_course_lesson_with_review_quiz(uuid,text,text,text,integer,integer,boolean,boolean,jsonb) TO service_role;

-- Grade and persist one complete attempt. Correct answers are resolved only in SQL.
CREATE OR REPLACE FUNCTION public.submit_course_lesson_review_quiz(
  p_lesson_id uuid, p_user_id uuid, p_answers jsonb
)
RETURNS public.course_lesson_review_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  created_attempt public.course_lesson_review_attempts;
  next_attempt integer;
  question_row public.course_lesson_review_questions;
  selected text;
  total_count integer;
  v_correct_count integer := 0;
  total_value numeric := 0;
  earned_value numeric := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server role required'; END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'Answers must be an object'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.course_lessons cl
    JOIN public.course_enrollments e ON e.course_id = cl.course_id
    WHERE cl.id = p_lesson_id AND e.user_id = p_user_id
  ) THEN RAISE EXCEPTION 'Enrollment required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_lesson_id::text || ':' || p_user_id::text, 0));
  SELECT COALESCE(max(attempt_number), 0) + 1 INTO next_attempt
  FROM public.course_lesson_review_attempts WHERE lesson_id = p_lesson_id AND user_id = p_user_id;
  SELECT count(*), COALESCE(sum(points), 0) INTO total_count, total_value
  FROM public.course_lesson_review_questions WHERE lesson_id = p_lesson_id;
  IF total_count = 0 THEN RAISE EXCEPTION 'Review quiz has no questions'; END IF;

  INSERT INTO public.course_lesson_review_attempts(
    lesson_id, user_id, attempt_number, total_questions, total_points
  ) VALUES (p_lesson_id, p_user_id, next_attempt, total_count, total_value)
  RETURNING * INTO created_attempt;

  FOR question_row IN SELECT * FROM public.course_lesson_review_questions WHERE lesson_id = p_lesson_id ORDER BY order_index LOOP
    selected := upper(trim(COALESCE(p_answers->>question_row.id::text, '')));
    IF selected !~ '^[A-H]$' THEN RAISE EXCEPTION 'Every question must have one valid answer'; END IF;
    IF selected = question_row.answer THEN
      v_correct_count := v_correct_count + 1;
      earned_value := earned_value + question_row.points;
    END IF;
    INSERT INTO public.course_lesson_review_answers(attempt_id, question_id, selected_answer, is_correct, awarded_points)
    VALUES (created_attempt.id, question_row.id, selected, selected = question_row.answer,
      CASE WHEN selected = question_row.answer THEN question_row.points ELSE 0 END);
  END LOOP;

  UPDATE public.course_lesson_review_attempts SET
    score = round(10 * earned_value / NULLIF(total_value, 0), 2),
    correct_count = v_correct_count,
    earned_points = earned_value,
    submitted_at = now()
  WHERE id = created_attempt.id RETURNING * INTO created_attempt;
  RETURN created_attempt;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_course_lesson_review_quiz(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_course_lesson_review_quiz(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE VIEW public.student_review_skill_mastery
WITH (security_invoker = true)
AS
WITH per_question AS (
  SELECT
    a.user_id,
    cl.course_id,
    q.knowledge_tag,
    q.id AS question_id,
    count(ans.id)::integer AS attempts,
    count(ans.id) FILTER (WHERE NOT ans.is_correct)::integer AS wrong_attempts,
    bool_or(ans.is_correct) AS eventually_correct,
    bool_or(ans.is_correct AND a.attempt_number = 1) AS first_try_correct,
    min(a.attempt_number) FILTER (WHERE ans.is_correct) AS attempts_until_correct,
    max(ans.answered_at) AS last_attempt_at
  FROM public.course_lesson_review_answers ans
  JOIN public.course_lesson_review_attempts a ON a.id = ans.attempt_id
  JOIN public.course_lesson_review_questions q ON q.id = ans.question_id
  JOIN public.course_lessons cl ON cl.id = q.lesson_id
  GROUP BY a.user_id, cl.course_id, q.knowledge_tag, q.id
)
SELECT
  user_id, course_id, knowledge_tag,
  count(*)::integer AS questions_attempted,
  count(*) FILTER (WHERE eventually_correct)::integer AS questions_mastered,
  sum(attempts)::integer AS total_attempts,
  sum(wrong_attempts)::integer AS wrong_attempts,
  round(100.0 * count(*) FILTER (WHERE first_try_correct) / NULLIF(count(*), 0))::integer AS first_try_accuracy,
  round(100.0 * count(*) FILTER (WHERE eventually_correct) / NULLIF(count(*), 0))::integer AS eventual_accuracy,
  round(avg(COALESCE(attempts_until_correct, attempts + 1)), 2) AS average_attempts_to_master,
  max(last_attempt_at) AS last_attempt_at,
  greatest(0, least(100, round(
    100.0 * count(*) FILTER (WHERE eventually_correct) / NULLIF(count(*), 0)
    - 8.0 * sum(wrong_attempts) / NULLIF(count(*), 0)
  )))::integer AS mastery_score
FROM per_question
GROUP BY user_id, course_id, knowledge_tag;

GRANT SELECT ON public.student_review_skill_mastery TO authenticated, service_role;
