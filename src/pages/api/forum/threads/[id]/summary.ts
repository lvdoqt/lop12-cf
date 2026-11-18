import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';

export const prerender = false;

/** Lưu tóm tắt ngắn do AI/giáo viên tạo cho thread (Phase 4). */
export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập.', 401);
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return jsonError('Chỉ giáo viên/quản trị viên được lưu tóm tắt.', 403);
  }
  const body = await context.request.json().catch(() => ({}));
  const summary = String(body.summary || '').trim();
  if (summary.length < 10) return jsonError('Tóm tắt quá ngắn.', 400);
  await db.setForumThreadSummary(context.params.id || '', summary);
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
