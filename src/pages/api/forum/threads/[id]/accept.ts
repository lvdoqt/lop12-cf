import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const user = await requireForumUser(context);
    if (!user) return jsonError('Bạn cần đăng nhập.', 401);

    const threadId = context.params.id || '';
    const body = await context.request.json().catch(() => ({}));
    const postId = String(body.postId || '').trim();
    if (!threadId || !postId) return jsonError('Thiếu thông tin câu trả lời.');

    const thread = await db.getForumThreadById(threadId);
    if (!thread) return jsonError('Không tìm thấy bài viết.', 404);

    const isStaff = user.role === 'teacher' || user.role === 'admin';
    if (thread.author_id !== user.id && !isStaff) {
      return jsonError('Chỉ người đăng bài hoặc giáo viên được chọn câu trả lời.', 403);
    }
    if (!thread.posts?.some(p => p.id === postId)) {
      return jsonError('Câu trả lời không thuộc bài viết này.', 400);
    }

    const updated = await db.acceptForumPost(threadId, postId);
    return new Response(JSON.stringify({ success: true, thread: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.accept.POST]', err);
    return jsonError(err?.message || 'Không thể chọn câu trả lời.', 500);
  }
};
