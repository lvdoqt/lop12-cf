-- ============================================================
-- LMS learning telemetry and mastery analytics
--
-- Extends the existing course model without replacing old data. Existing
-- completed lesson rows remain completed and existing video responses are
-- included in the analytics views.
-- ============================================================

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.course_enrollments
  DROP CONSTRAINT IF EXISTS course_enrollments_status_check;
ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_status_check
  CHECK (status IN ('active', 'completed', 'paused'));

ALTER TABLE public.lesson_progress
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_position_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_watched_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_session_id uuid;

UPDATE public.lesson_progress
SET status = CASE WHEN completed THEN 'completed' ELSE 'in_progress' END,
    started_at = COALESCE(started_at, completed_at),
    last_accessed_at = COALESCE(last_accessed_at, completed_at),
    updated_at = COALESCE(updated_at, completed_at, now())
WHERE status IS DISTINCT FROM CASE WHEN completed THEN 'completed' ELSE 'in_progress' END
   OR started_at IS NULL
   OR last_accessed_at IS NULL;

ALTER TABLE public.lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_status_check;
ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_status_check
  CHECK (status IN ('in_progress', 'completed'));

ALTER TABLE public.lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_nonnegative_check;
ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_nonnegative_check CHECK (
    time_spent_seconds >= 0
    AND video_position_seconds >= 0
    AND video_duration_seconds >= 0
    AND video_watched_seconds >= 0
    AND visit_count >= 1
  );

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_activity
  ON public.lesson_progress(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_activity
  ON public.course_enrollments(course_id, last_activity_at DESC);

-- A knowledge tag is what turns raw right/wrong events into actionable data.
-- Teachers can use a chapter, concept or learning objective, e.g. "Đạo hàm/Đơn điệu".
ALTER TABLE public.course_lesson_quizzes
  ADD COLUMN IF NOT EXISTS knowledge_tag text NOT NULL DEFAULT 'Chưa phân loại',
  ADD COLUMN IF NOT EXISTS difficulty smallint NOT NULL DEFAULT 2;

-- The old public SELECT policy exposed the answer column through Supabase REST,
-- even though the Astro endpoint removed it. Keep row visibility for prompts but
-- remove column-level access to answers and explanations from browser roles.
REVOKE SELECT ON public.course_lesson_quizzes FROM anon, authenticated;
GRANT SELECT (
  id, lesson_id, timestamp_sec, question, options, order_index, created_at,
  knowledge_tag, difficulty
) ON public.course_lesson_quizzes TO anon, authenticated;
GRANT SELECT ON public.course_lesson_quizzes TO service_role;

ALTER TABLE public.course_lesson_quizzes
  DROP CONSTRAINT IF EXISTS course_lesson_quizzes_difficulty_check;
ALTER TABLE public.course_lesson_quizzes
  ADD CONSTRAINT course_lesson_quizzes_difficulty_check CHECK (difficulty BETWEEN 1 AND 3);

CREATE INDEX IF NOT EXISTS idx_clq_knowledge_tag
  ON public.course_lesson_quizzes(lesson_id, knowledge_tag);

ALTER TABLE public.video_quiz_responses
  ADD COLUMN IF NOT EXISTS response_time_ms integer,
  ADD COLUMN IF NOT EXISTS video_position_seconds integer,
  ADD COLUMN IF NOT EXISTS client_event_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vqr_client_event_id
  ON public.video_quiz_responses(client_event_id)
  WHERE client_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vqr_user_quiz_attempt
  ON public.video_quiz_responses(user_id, quiz_id, attempt_number);

ALTER TABLE public.video_quiz_responses
  DROP CONSTRAINT IF EXISTS video_quiz_responses_learner_check;
ALTER TABLE public.video_quiz_responses
  ADD CONSTRAINT video_quiz_responses_learner_check
  CHECK ((user_id IS NOT NULL) <> (guest_id IS NOT NULL)) NOT VALID;

ALTER TABLE public.video_quiz_responses
  DROP CONSTRAINT IF EXISTS video_quiz_responses_telemetry_check;
ALTER TABLE public.video_quiz_responses
  ADD CONSTRAINT video_quiz_responses_telemetry_check CHECK (
    (response_time_ms IS NULL OR response_time_ms BETWEEN 0 AND 3600000)
    AND (video_position_seconds IS NULL OR video_position_seconds BETWEEN 0 AND 86400)
    AND (guest_id IS NULL OR length(guest_id) BETWEEN 8 AND 128)
  ) NOT VALID;

-- Never trust is_correct, lesson_id or attempt_number sent by a browser. The
-- trigger derives all three from the canonical quiz and serializes attempts per
-- learner/question, preventing duplicate attempt numbers under concurrent calls.
CREATE OR REPLACE FUNCTION public.prepare_video_quiz_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canonical_lesson_id uuid;
  canonical_answer text;
  learner_key text;
BEGIN
  SELECT lesson_id, upper(answer)
  INTO canonical_lesson_id, canonical_answer
  FROM public.course_lesson_quizzes
  WHERE id = NEW.quiz_id;

  IF canonical_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;
  IF (NEW.user_id IS NULL) = (NEW.guest_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one learner identity is required';
  END IF;

  NEW.lesson_id := canonical_lesson_id;
  NEW.selected_answer := upper(trim(NEW.selected_answer));
  NEW.is_correct := NEW.selected_answer = canonical_answer;
  learner_key := COALESCE(NEW.user_id::text, 'guest:' || NEW.guest_id);

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.quiz_id::text || ':' || learner_key, 0));
  SELECT COALESCE(max(attempt_number), 0) + 1
  INTO NEW.attempt_number
  FROM public.video_quiz_responses
  WHERE quiz_id = NEW.quiz_id
    AND ((NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (NEW.guest_id IS NOT NULL AND guest_id = NEW.guest_id));

  NEW.answered_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_video_quiz_response ON public.video_quiz_responses;
CREATE TRIGGER trg_prepare_video_quiz_response
BEFORE INSERT ON public.video_quiz_responses
FOR EACH ROW EXECUTE FUNCTION public.prepare_video_quiz_response();

-- Responses must pass through the server endpoint. The service-role client used
-- by the endpoint bypasses RLS; direct browser inserts can no longer forge scores.
DROP POLICY IF EXISTS "anyone_insert_response" ON public.video_quiz_responses;

-- Atomic lesson heartbeat. Only the server role may call it, so a browser cannot
-- award itself arbitrary study time. Delta values are capped again in SQL.
CREATE OR REPLACE FUNCTION public.record_lesson_activity(
  p_lesson_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_active_seconds integer DEFAULT 0,
  p_watched_seconds integer DEFAULT 0,
  p_video_position_seconds integer DEFAULT NULL,
  p_video_duration_seconds integer DEFAULT NULL,
  p_complete boolean DEFAULT false
)
RETURNS public.lesson_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.lesson_progress;
  target_course_id uuid;
  safe_active integer := greatest(0, least(COALESCE(p_active_seconds, 0), 60));
  safe_watched integer := greatest(0, least(COALESCE(p_watched_seconds, 0), 60));
  safe_position integer := CASE WHEN p_video_position_seconds IS NULL THEN NULL ELSE greatest(0, least(p_video_position_seconds, 86400)) END;
  safe_duration integer := CASE WHEN p_video_duration_seconds IS NULL THEN NULL ELSE greatest(0, least(p_video_duration_seconds, 86400)) END;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server role required';
  END IF;

  SELECT course_id INTO target_course_id
  FROM public.course_lessons
  WHERE id = p_lesson_id;

  IF target_course_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE course_id = target_course_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Enrollment required';
  END IF;

  INSERT INTO public.lesson_progress (
    lesson_id, user_id, completed, completed_at, status, started_at,
    last_accessed_at, updated_at, time_spent_seconds,
    video_position_seconds, video_duration_seconds, video_watched_seconds,
    visit_count, last_session_id
  ) VALUES (
    p_lesson_id, p_user_id, p_complete,
    CASE WHEN p_complete THEN now() ELSE NULL END,
    CASE WHEN p_complete THEN 'completed' ELSE 'in_progress' END,
    now(), now(), now(), safe_active,
    COALESCE(safe_position, 0), COALESCE(safe_duration, 0),
    least(CASE WHEN COALESCE(safe_duration, 0) > 0 THEN safe_duration ELSE 2147483647 END, safe_watched),
    1, p_session_id
  )
  ON CONFLICT (lesson_id, user_id) DO UPDATE SET
    completed = lesson_progress.completed OR EXCLUDED.completed,
    completed_at = CASE
      WHEN lesson_progress.completed_at IS NOT NULL THEN lesson_progress.completed_at
      WHEN EXCLUDED.completed THEN now()
      ELSE NULL
    END,
    status = CASE WHEN lesson_progress.completed OR EXCLUDED.completed THEN 'completed' ELSE 'in_progress' END,
    started_at = COALESCE(lesson_progress.started_at, now()),
    last_accessed_at = now(),
    updated_at = now(),
    time_spent_seconds = lesson_progress.time_spent_seconds + safe_active,
    video_position_seconds = COALESCE(safe_position, lesson_progress.video_position_seconds),
    video_duration_seconds = greatest(lesson_progress.video_duration_seconds, COALESCE(safe_duration, 0)),
    video_watched_seconds = least(
      CASE
        WHEN greatest(lesson_progress.video_duration_seconds, COALESCE(safe_duration, 0)) > 0
          THEN greatest(lesson_progress.video_duration_seconds, COALESCE(safe_duration, 0))
        ELSE 2147483647
      END,
      lesson_progress.video_watched_seconds + safe_watched
    ),
    visit_count = lesson_progress.visit_count + CASE
      WHEN lesson_progress.last_session_id IS DISTINCT FROM p_session_id THEN 1 ELSE 0
    END,
    last_session_id = p_session_id
  RETURNING * INTO result;

  UPDATE public.course_enrollments
  SET last_activity_at = now(),
      status = CASE
        WHEN p_complete AND NOT EXISTS (
          SELECT 1
          FROM public.course_lessons cl
          WHERE cl.course_id = target_course_id
            AND cl.is_published
            AND NOT EXISTS (
              SELECT 1 FROM public.lesson_progress lp
              WHERE lp.lesson_id = cl.id AND lp.user_id = p_user_id AND lp.completed
            )
        ) THEN 'completed'
        WHEN status = 'completed' THEN status
        ELSE 'active'
      END,
      completed_at = CASE
        WHEN p_complete AND NOT EXISTS (
          SELECT 1
          FROM public.course_lessons cl
          WHERE cl.course_id = target_course_id
            AND cl.is_published
            AND NOT EXISTS (
              SELECT 1 FROM public.lesson_progress lp
              WHERE lp.lesson_id = cl.id AND lp.user_id = p_user_id AND lp.completed
            )
        ) THEN COALESCE(completed_at, now())
        ELSE completed_at
      END
  WHERE course_id = target_course_id AND user_id = p_user_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_lesson_activity(uuid, uuid, uuid, integer, integer, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lesson_activity(uuid, uuid, uuid, integer, integer, integer, integer, boolean) TO service_role;

-- One row per student/question, then one row per knowledge tag. A concept is
-- considered mastered only after the learner has answered it correctly; wrong
-- attempts remain visible and lower the mastery score.
CREATE OR REPLACE VIEW public.student_skill_mastery
WITH (security_invoker = true)
AS
WITH per_question AS (
  SELECT
    r.user_id,
    cl.course_id,
    q.knowledge_tag,
    q.id AS quiz_id,
    count(*)::integer AS attempts,
    count(*) FILTER (WHERE NOT r.is_correct)::integer AS wrong_attempts,
    bool_or(r.is_correct) AS eventually_correct,
    bool_or(r.is_correct AND r.attempt_number = 1) AS first_try_correct,
    min(r.attempt_number) FILTER (WHERE r.is_correct) AS attempts_until_correct,
    max(r.answered_at) AS last_attempt_at
  FROM public.video_quiz_responses r
  JOIN public.course_lesson_quizzes q ON q.id = r.quiz_id
  JOIN public.course_lessons cl ON cl.id = q.lesson_id
  WHERE r.user_id IS NOT NULL
  GROUP BY r.user_id, cl.course_id, q.knowledge_tag, q.id
)
SELECT
  user_id,
  course_id,
  knowledge_tag,
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

COMMENT ON VIEW public.student_skill_mastery IS
  'Per-student mastery by teacher-defined knowledge tag; use low mastery_score/high wrong_attempts to target remediation.';

GRANT SELECT ON public.student_skill_mastery TO authenticated, service_role;
