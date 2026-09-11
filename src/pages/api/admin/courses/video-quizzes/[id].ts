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

  const { timestamp_sec, question, options, answer, explanation, knowledge_tag, difficulty } = body;
  
  const updates: any = {};
  if (timestamp_sec !== undefined) {
    const value = Number(timestamp_sec);
    if (!Number.isInteger(value) || value < 0) {
      return new Response(JSON.stringify({ error: 'timestamp_sec must be a non-negative integer' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    updates.timestamp_sec = value;
  }
  if (question !== undefined) updates.question = String(question);
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      return new Response(JSON.stringify({ error: 'options must be array with at least 2 items' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    updates.options = options.map(String);
  }
  if (answer !== undefined) {
    const value = String(answer).toUpperCase();
    const optionCount = Array.isArray(options) ? options.length : 4;
    if (!Array.from({ length: optionCount }, (_, index) => String.fromCharCode(65 + index)).includes(value)) {
      return new Response(JSON.stringify({ error: 'answer must match an option' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    updates.answer = value;
  }
  if (explanation !== undefined) updates.explanation = explanation || null;
  if (knowledge_tag !== undefined) updates.knowledge_tag = String(knowledge_tag || 'Chưa phân loại').trim().slice(0, 120) || 'Chưa phân loại';
  if (difficulty !== undefined) {
    const value = Number(difficulty);
    if (![1, 2, 3].includes(value)) {
      return new Response(JSON.stringify({ error: 'difficulty must be 1, 2 or 3' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    updates.difficulty = value;
  }

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
