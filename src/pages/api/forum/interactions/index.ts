import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';
import { jsonError, requireForumUser } from '../../../../lib/forum-auth';

export const prerender = false;

/** Trạng thái cảm xúc/bookmark/follow của người đang đăng nhập (1 request cho cả trang). */
export const GET: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập.', 401);
  const state = await db.getForumInteractions(user.id);
  return new Response(JSON.stringify({ success: true, ...state }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
