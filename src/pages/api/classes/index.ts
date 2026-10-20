import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

/** GET /api/classes — list classes for current teacher */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const teacherId = user.role === 'admin' ? undefined : user.id;
  const classes = await db.getClasses(teacherId);
  return new Response(JSON.stringify(classes), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

/** POST /api/classes — create a new class */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, grade, subject, color } = body;
    if (!name?.trim()) return new Response(JSON.stringify({ error: 'Tên lớp không được để trống.' }), { status: 400 });
    const cls = await db.createClass({
      name: name.trim(),
      grade: grade || '12',
      subject: subject || '',
      color: color || '#6366f1',
      teacher_id: user.id,
    });
    return new Response(JSON.stringify(cls), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
