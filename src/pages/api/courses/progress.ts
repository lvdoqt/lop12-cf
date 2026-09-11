import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { lessonId } = body;
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

    const action = ['start', 'heartbeat', 'complete'].includes(body.action) ? body.action : 'complete';
    const sessionId = typeof body.sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.sessionId)
      ? body.sessionId
      : crypto.randomUUID();
    const progress = await db.recordLessonActivity({
      lessonId,
      userId: user.id,
      sessionId,
      activeSeconds: action === 'heartbeat' ? Number(body.activeSeconds || 0) : 0,
      watchedSeconds: action === 'heartbeat' ? Number(body.watchedSeconds || 0) : 0,
      videoPositionSeconds: body.videoPositionSeconds == null ? undefined : Number(body.videoPositionSeconds),
      videoDurationSeconds: body.videoDurationSeconds == null ? undefined : Number(body.videoDurationSeconds),
      complete: action === 'complete',
    });
    return new Response(JSON.stringify({ success: true, progress }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
