-- Restrict video-quiz management and response analytics to the course owner
-- (or an administrator), including when the Supabase API is called directly.
DROP POLICY IF EXISTS "teacher_manage_quizzes" ON course_lesson_quizzes;
CREATE POLICY "teacher_manage_quizzes"
  ON course_lesson_quizzes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1
      FROM course_lessons cl
      JOIN courses c ON c.id = cl.course_id
      JOIN users u ON u.id = auth.uid()
      WHERE cl.id = course_lesson_quizzes.lesson_id
        AND c.created_by = auth.uid()
        AND u.role = 'teacher'
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1
      FROM course_lessons cl
      JOIN courses c ON c.id = cl.course_id
      JOIN users u ON u.id = auth.uid()
      WHERE cl.id = course_lesson_quizzes.lesson_id
        AND c.created_by = auth.uid()
        AND u.role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "read_own_responses" ON video_quiz_responses;
CREATE POLICY "read_own_responses"
  ON video_quiz_responses FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1
      FROM course_lessons cl
      JOIN courses c ON c.id = cl.course_id
      JOIN users u ON u.id = auth.uid()
      WHERE cl.id = video_quiz_responses.lesson_id
        AND c.created_by = auth.uid()
        AND u.role = 'teacher'
    )
  );
