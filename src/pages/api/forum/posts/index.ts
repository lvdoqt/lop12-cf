import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';
import { jsonError, requireForumUser } from '../../../../lib/forum-auth';
import { checkForumRateLimit, isHoneypotTrapped } from '../../../../lib/forum-security';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const user = await requireForumUser(context);
    if (!user) return jsonError('Bạn cần đăng nhập để trả lời.', 401);

    const body = await context.request.json();
    if (isHoneypotTrapped(body)) return jsonError('Không thể gửi trả lời.', 400);
    const rate = checkForumRateLimit(`forum-post:${user.id}`, 12, 60_000);
    if (!rate.ok) return jsonError('Bạn trả lời quá nhanh. Vui lòng đợi một lát.', 429);

    const threadId = String(body.threadId || '').trim();
    const text = String(body.body || '').trim();
    const parentId = body.parentId ? String(body.parentId) : null;

    if (!threadId) return jsonError('Thread không hợp lệ.');
    if (text.length < 5 || text.length > 20_000) {
      return jsonError('Nội dung trả lời phải từ 5 đến 20.000 ký tự.');
    }

    const thread = await db.getForumThreadById(threadId);
    if (!thread) return jsonError('Không tìm thấy bài viết.', 404);
    if (thread.status === 'locked' || thread.status === 'archived') {
      return jsonError('Bài viết này đã bị khoá.', 403);
    }

    const post = await db.createForumPost({
      threadId,
      authorId: user.id,
      body: text,
      parentId,
    });

    return new Response(JSON.stringify({ success: true, post }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.posts.POST]', err);
    return jsonError(err?.message || 'Không thể gửi trả lời. Vui lòng thử lại.', 500);
  }
};
