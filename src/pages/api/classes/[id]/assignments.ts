import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

/** GET /api/classes/[id]/assignments — list assignments for a class */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const assignments = await db.getClassAssignments(params.id!);
  return new Response(JSON.stringify(assignments), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

/** POST /api/classes/[id]/assignments — create an assignment */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const body = await request.json();
    const { type, ref_id, ref_title, deadline, note, attachment_url, attachment_type, youtube_url } = body;
    
    if (!type) {
      return new Response(JSON.stringify({ error: 'Loại bài tập (type) là bắt buộc.' }), { status: 400 });
    }

    if (type === 'material') {
      if (!ref_title) {
        return new Response(JSON.stringify({ error: 'Tiêu đề tài liệu/video là bắt buộc.' }), { status: 400 });
      }
      if (!attachment_url && !youtube_url) {
        return new Response(JSON.stringify({ error: 'Vui lòng cung cấp link tài liệu hoặc link YouTube.' }), { status: 400 });
      }
    } else if (!ref_id) {
      return new Response(JSON.stringify({ error: 'type và ref_id là bắt buộc.' }), { status: 400 });
    }

    const assignment = await db.createAssignment({
      class_id: params.id!,
      type,
      ref_id: ref_id || `mat-${Date.now()}`,
      ref_title: ref_title || '',
      assigned_by: user.id,
      deadline: deadline || null,
      note: note || '',
      attachment_url: attachment_url || null,
      attachment_type: attachment_type || null,
      youtube_url: youtube_url || null,
    });
    return new Response(JSON.stringify(assignment), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

/** DELETE /api/classes/[id]/assignments — delete an assignment (body: { assignmentId }) */
export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const { assignmentId } = await request.json();
    if (!assignmentId) return new Response(JSON.stringify({ error: 'assignmentId required' }), { status: 400 });
    await db.deleteAssignment(assignmentId);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
