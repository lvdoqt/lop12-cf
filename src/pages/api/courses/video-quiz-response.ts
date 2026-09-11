import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

// POST /api/courses/video-quiz-response
// Body: { quizId, lessonId, selectedAnswer, guestId? }
// Returns saved grading and lifetime attempt/mistake counts for this learner.
export const POST: APIRoute = async ({ request, locals }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { quizId, lessonId, selectedAnswer, guestId, responseTimeMs, videoPositionSeconds, clientEventId } = body || {};
  if (!quizId || !lessonId || !selectedAnswer) {
    return new Response(JSON.stringify({ error: 'quizId, lessonId, selectedAnswer required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
  // Fetch the quiz to validate the answer (server-side, secure)
  const quizzes = await db.getVideoQuizzes(lessonId);
  const quiz = quizzes.find(q => q.id === quizId);
  if (!quiz) {
    return new Response(JSON.stringify({ error: 'Quiz not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = (locals as any).user;
  const normalizedGuestId = !user && typeof guestId === 'string' && guestId.length >= 8 && guestId.length <= 128
    ? guestId
    : undefined;
  const normalizedAnswer = String(selectedAnswer).trim().toUpperCase();
  const validAnswers = quiz.options.map((_, index) => String.fromCharCode(65 + index));
  if (!validAnswers.includes(normalizedAnswer)) {
    return new Response(JSON.stringify({ error: 'Invalid selectedAnswer' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const lesson = await db.getCourseLessonById(lessonId);
  const course = lesson ? await db.getCourseById(lesson.course_id) : null;
  if (!lesson || lesson.id !== quiz.lesson_id || !lesson.is_published || !course?.is_published) {
    return new Response(JSON.stringify({ error: 'Lesson not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
  const canAccess = user
    ? await db.isUserEnrolled(lesson.course_id, user.id) || lesson.is_free
    : lesson.is_free && !!normalizedGuestId;
  if (!canAccess) {
    return new Response(JSON.stringify({ error: 'Enrollment required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const isCorrect = normalizedAnswer === quiz.answer.toUpperCase();

  // Count previous attempts by this user/guest for this specific quiz
  const attemptCounts = await db.getVideoQuizAttemptCounts(
    lessonId,
    user?.id,
    normalizedGuestId
  );
  const attemptNumber = (attemptCounts[quizId] || 0) + 1;

  // Save the response
  const saved = await db.saveVideoQuizResponse({
    quiz_id: quizId,
    lesson_id: lessonId,
    user_id: user?.id || null,
    guest_id: user ? null : (normalizedGuestId || null),
    selected_answer: normalizedAnswer,
    is_correct: isCorrect,
    attempt_number: attemptNumber,
    response_time_ms: Number.isFinite(Number(responseTimeMs)) ? Math.max(0, Math.min(3600000, Math.round(Number(responseTimeMs)))) : null,
    video_position_seconds: Number.isFinite(Number(videoPositionSeconds)) ? Math.max(0, Math.round(Number(videoPositionSeconds))) : null,
    client_event_id: typeof clientEventId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientEventId) ? clientEventId : null,
  });
  const stats = await db.getVideoQuizAttemptStats(lessonId, user?.id, normalizedGuestId);

  return new Response(
    JSON.stringify({
      isCorrect: saved.is_correct,
      explanation: saved.is_correct ? (quiz.explanation || null) : null,
      attemptNumber: stats[quizId]?.attempts || saved.attempt_number,
      wrongAttempts: stats[quizId]?.wrongAttempts || 0,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
  } catch (error) {
    console.error('Could not save video quiz response:', error);
    return Response.json({ error: 'Không thể lưu câu trả lời. Vui lòng thử lại.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
};
