import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

// POST /api/courses/video-quiz-response
// Body: { quizId, lessonId, selectedAnswer, guestId? }
// Returns: { isCorrect, explanation, attemptNumber }
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

  const { quizId, lessonId, selectedAnswer, guestId } = body;
  if (!quizId || !lessonId || !selectedAnswer) {
    return new Response(JSON.stringify({ error: 'quizId, lessonId, selectedAnswer required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
  const isCorrect = selectedAnswer.toUpperCase() === quiz.answer.toUpperCase();

  // Count previous attempts by this user/guest for this specific quiz
  const attemptCounts = await db.getVideoQuizAttemptCounts(
    lessonId,
    user?.id,
    !user ? (guestId || undefined) : undefined
  );
  const attemptNumber = (attemptCounts[quizId] || 0) + 1;

  // Save the response
  await db.saveVideoQuizResponse({
    quiz_id: quizId,
    lesson_id: lessonId,
    user_id: user?.id || null,
    guest_id: user ? null : (guestId || null),
    selected_answer: selectedAnswer.toUpperCase(),
    is_correct: isCorrect,
    attempt_number: attemptNumber,
  });

  return new Response(
    JSON.stringify({
      isCorrect,
      explanation: isCorrect ? (quiz.explanation || null) : null,
      attemptNumber,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
};
