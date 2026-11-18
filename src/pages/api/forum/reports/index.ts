import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';
import { jsonError, requireForumUser } from '../../../../lib/forum-auth';
import { checkForumRateLimit, isHoneypotTrapped } from '../../../../lib/forum-security';
import type { ForumReportReason } from '../../../../types';

export const prerender = false;

const REASONS: ForumReportReason[] = ['spam', 'offtopic', 'abuse', 'wrong', 'other'];

export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập để báo cáo.', 401);

  const body = await context.request.json().catch(() => ({}));
  if (isHoneypotTrapped(body)) return jsonError('Không thể gửi yêu cầu.', 400);

  const reason = String(body.reason || '') as ForumReportReason;
  if (!REASONS.includes(reason)) return jsonError('Lý do báo cáo không hợp lệ.', 400);

  const threadId = body.threadId ? String(body.threadId) : null;
  const postId = body.postId ? String(body.postId) : null;
  if (!threadId && !postId) return jsonError('Thiếu nội dung cần báo cáo.');

  const limit = checkForumRateLimit(`forum-report:${user.id}`, 8, 60_000);
  if (!limit.ok) return jsonError('Báo cáo quá nhiều lần, vui lòng thử lại sau.', 429);

  try {
    const report = await db.createForumReport({
      threadId, postId, reporterId: user.id, reason,
      details: String(body.details || '').slice(0, 1000),
    });
    return new Response(JSON.stringify({ success: true, report }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.reports.POST]', err);
    return jsonError(err?.message || 'Không thể gửi báo cáo.', 500);
  }
};
