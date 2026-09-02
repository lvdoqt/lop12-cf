import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

// GET /api/courses/video-quizzes?lessonId=xxx
// Returns quiz questions for a lesson — answer field is EXCLUDED for security
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const lessonId = url.searchParams.get('lessonId');

  if (!lessonId) {
    return new Response(JSON.stringify({ error: 'lessonId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const quizzes = await db.getVideoQuizzes(lessonId);
    // Strip out the correct answer before sending to client
    const safeQuizzes = quizzes.map(({ answer: _answer, explanation: _exp, ...q }) => q);
    return new Response(JSON.stringify(safeQuizzes), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
