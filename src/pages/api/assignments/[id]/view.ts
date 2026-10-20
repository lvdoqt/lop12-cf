import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

/**
 * POST /api/assignments/[id]/view
 * Ghi nhận lượt xem tài liệu hoặc video YouTube của học sinh
 * Body: { viewType: 'document' | 'youtube' }
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Vui lòng đăng nhập để ghi nhận lượt xem.' }), { status: 401 });
  }

  const assignmentId = params.id;
  if (!assignmentId) {
    return new Response(JSON.stringify({ error: 'assignmentId is required' }), { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const viewType = body.viewType === 'youtube' ? 'youtube' : 'document';

    const viewRecord = await db.recordAssignmentView(assignmentId, user.id, viewType);
    return new Response(JSON.stringify({ ok: true, data: viewRecord }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[API recordAssignmentView error]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Lỗi ghi nhận lượt xem' }), { status: 500 });
  }
};
