import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError } from '../../../../../lib/forum-auth';

export const prerender = false;

/** Phase 2: lightweight polling endpoint — client chỉ tải vài byte để biết có trả lời mới. */
export const GET: APIRoute = async (context) => {
  const thread = await db.getForumThreadById(context.params.id || '');
  if (!thread) return jsonError('Không tìm thấy bài viết.', 404);
  return new Response(JSON.stringify({
    success: true,
    reply_count: thread.reply_count ?? 0,
    last_activity_at: thread.last_activity_at,
    status: thread.status,
    accepted_post_id: thread.accepted_post_id,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
