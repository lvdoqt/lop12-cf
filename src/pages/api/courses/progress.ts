import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { lessonId } = await request.json();
    if (!lessonId) {
      return new Response(JSON.stringify({ error: 'Missing lessonId' }), { status: 400 });
    }

    const lesson = await db.getCourseLessonById(lessonId);
    if (!lesson) {
      return new Response(JSON.stringify({ error: 'Lesson not found' }), { status: 404 });
    }

    // Verify enrollment
    const isEnrolled = await db.isUserEnrolled(lesson.course_id, user.id);
    if (!isEnrolled) {
      return new Response(JSON.stringify({ error: 'User not enrolled in this course' }), { status: 403 });
    }

    const progress = await db.markLessonComplete(lessonId, user.id);
    return new Response(JSON.stringify({ success: true, progress }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
