import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập.', 401);
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return jsonError('Chỉ giáo viên/quản trị viên được xử lý báo cáo.', 403);
  }

  const body = await context.request.json().catch(() => ({}));
  const status = body.status === 'dismissed' ? 'dismissed' : 'resolved';
  await db.resolveForumReport(context.params.id || '', status, user.id);
  return new Response(JSON.stringify({ success: true, status }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
