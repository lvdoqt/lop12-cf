import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

async function ensureLessonOwner(user: any, lessonId: string): Promise<Response | null> {
  const lesson = await db.getCourseLessonById(lessonId);
  if (!lesson) return new Response(JSON.stringify({ error: 'Lesson not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const course = await db.getCourseById(lesson.course_id);
  if (!course) return new Response(JSON.stringify({ error: 'Course not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  if (user.role === 'teacher' && course.created_by !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  return null;
}

// POST /api/admin/courses/video-quizzes — create a new quiz
export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as any).user;
  if (!user || !['admin', 'teacher'].includes(user.role)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { lessonId, timestamp_sec, question, options, answer, explanation, order_index } = body;
  if (!lessonId || timestamp_sec == null || !question || !options || !answer) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return new Response(JSON.stringify({ error: 'options must be array with at least 2 items' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const authorizationError = await ensureLessonOwner(user, lessonId);
    if (authorizationError) return authorizationError;
    const quiz = await db.createVideoQuiz({
      lesson_id: lessonId,
      timestamp_sec: Number(timestamp_sec),
      question: String(question),
      options: options.map(String),
      answer: String(answer).toUpperCase(),
      explanation: explanation || null,
      order_index: Number(order_index ?? 0),
    });
    return new Response(JSON.stringify(quiz), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
