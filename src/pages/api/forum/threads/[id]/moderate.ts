import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';

export const prerender = false;

const ACTIONS = ['pin', 'unpin', 'lock', 'unlock', 'archive'] as const;

export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập.', 401);
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return jsonError('Chỉ giáo viên/quản trị viên được kiểm duyệt.', 403);
  }

  const body = await context.request.json().catch(() => ({}));
  const action = body.action;
  if (!ACTIONS.includes(action)) return jsonError('Hành động không hợp lệ.', 400);

  try {
    const thread = await db.moderateForumThread(context.params.id || '', action);
    return new Response(JSON.stringify({ success: true, thread }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.moderate.POST]', err);
    return jsonError(err?.message || 'Không thể kiểm duyệt bài viết.', 500);
  }
};
