import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';

export const prerender = false;

/** Phase 4: giáo viên biến một thread thành câu hỏi tự luận trong ngân hàng đề. */
export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập.', 401);
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return jsonError('Chỉ giáo viên/quản trị viên được thực hiện.', 403);
  }

  try {
    const question = await db.convertForumThreadToQuestion(context.params.id || '', user.id);
    if (!question) return jsonError('Không tìm thấy bài viết.', 404);
    return new Response(JSON.stringify({ success: true, question }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.toQuestion.POST]', err);
    return jsonError(err?.message || 'Không thể chuyển thành câu hỏi.', 500);
  }
};
