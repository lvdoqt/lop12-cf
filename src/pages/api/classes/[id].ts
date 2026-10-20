import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

/** PATCH /api/classes/[id] — update class */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const id = params.id!;
  // Verify ownership
  const cls = await db.getClassById(id);
  if (!cls) return new Response(JSON.stringify({ error: 'Không tìm thấy lớp.' }), { status: 404 });
  if (user.role !== 'admin' && cls.teacher_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  try {
    const body = await request.json();
    await db.updateClass(id, { name: body.name, grade: body.grade, subject: body.subject, color: body.color });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

/** DELETE /api/classes/[id] — delete class */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const id = params.id!;
  const cls = await db.getClassById(id);
  if (!cls) return new Response(JSON.stringify({ error: 'Không tìm thấy lớp.' }), { status: 404 });
  if (user.role !== 'admin' && cls.teacher_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  try {
    await db.deleteClass(id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
