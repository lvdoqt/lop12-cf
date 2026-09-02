import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';

async function ensureQuizOwner(user: any, quizId: string): Promise<Response | null> {
  const quiz = await db.getVideoQuizById(quizId);
  if (!quiz) return new Response(JSON.stringify({ error: 'Quiz not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const lesson = await db.getCourseLessonById(quiz.lesson_id);
  const course = lesson ? await db.getCourseById(lesson.course_id) : null;
  if (!course) return new Response(JSON.stringify({ error: 'Course not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  if (user.role === 'teacher' && course.created_by !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return null;
}

// PUT /api/admin/courses/video-quizzes/[id] — update a quiz
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = (locals as any).user;
  if (!user || !['admin', 'teacher'].includes(user.role)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const authorizationError = await ensureQuizOwner(user, id);
  if (authorizationError) return authorizationError;

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { timestamp_sec, question, options, answer, explanation } = body;
  
  const updates: any = {};
  if (timestamp_sec !== undefined) updates.timestamp_sec = Number(timestamp_sec);
  if (question !== undefined) updates.question = String(question);
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      return new Response(JSON.stringify({ error: 'options must be array with at least 2 items' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    updates.options = options.map(String);
  }
  if (answer !== undefined) updates.answer = String(answer).toUpperCase();
  if (explanation !== undefined) updates.explanation = explanation || null;

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'No updates provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const quiz = await db.updateVideoQuiz(id, updates);
    return new Response(JSON.stringify(quiz), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// DELETE /api/admin/courses/video-quizzes/[id] — delete a quiz
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = (locals as any).user;
  if (!user || !['admin', 'teacher'].includes(user.role)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  try {
    const authorizationError = await ensureQuizOwner(user, id);
    if (authorizationError) return authorizationError;
    await db.deleteVideoQuiz(id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
