import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';
import { checkForumRateLimit } from '../../../../../lib/forum-security';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập để lưu bài viết.', 401);

  const limit = checkForumRateLimit(`forum-bookmark:${user.id}`, 30, 60_000);
  if (!limit.ok) return jsonError('Thao tác quá nhanh, thử lại sau.', 429);

  try {
    const active = await db.toggleForumBookmark(context.params.id || '', user.id);
    return new Response(JSON.stringify({ success: true, active }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.bookmark.POST]', err);
    return jsonError(err?.message || 'Không thể cập nhật danh sách lưu.', 500);
  }
};
