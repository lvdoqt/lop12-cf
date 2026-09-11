import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

// Lifetime statistics only: every new viewing must still complete its quizzes.
export const GET: APIRoute = async ({ url, locals }) => {
  const lessonId = url.searchParams.get('lessonId');
  const guestId = url.searchParams.get('guestId');
  if (!lessonId) {
    return new Response(JSON.stringify({ error: 'lessonId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const user = locals.user;
  if (!user && (!guestId || guestId.length < 8 || guestId.length > 128)) {
    return Response.json({ error: 'guestId required' }, { status: 400 });
  }
  try {
  const lesson = await db.getCourseLessonById(lessonId);
  const course = lesson ? await db.getCourseById(lesson.course_id) : null;
  if (!lesson?.is_published || !course?.is_published) return Response.json({ error: 'Lesson not found' }, { status: 404 });
  if (!lesson.is_free && (!user || !await db.isUserEnrolled(lesson.course_id, user.id))) {
    return Response.json({ error: 'Enrollment required' }, { status: 403 });
  }
  const stats = await db.getVideoQuizAttemptStats(lessonId, user?.id, user ? undefined : guestId!);
  return new Response(JSON.stringify({
    stats,
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  } catch (error) {
    console.error('Could not load video quiz statistics:', error);
    return Response.json({ error: 'Không thể tải số lần làm bài.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
};
