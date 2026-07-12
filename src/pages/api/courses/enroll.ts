import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { courseId } = await request.json();
    if (!courseId) {
      return new Response(JSON.stringify({ error: 'Missing courseId' }), { status: 400 });
    }

    const course = await db.getCourseById(courseId);
    if (!course || !course.is_published) {
      return new Response(JSON.stringify({ error: 'Course not found or not published' }), { status: 404 });
    }

    const enrollment = await db.enrollUserInCourse(courseId, user.id);
    return new Response(JSON.stringify({ success: true, enrollment }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
