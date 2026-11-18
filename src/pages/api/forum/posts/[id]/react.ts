import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { jsonError, requireForumUser } from '../../../../../lib/forum-auth';
import { checkForumRateLimit, isHoneypotTrapped } from '../../../../../lib/forum-security';
import type { ForumReactionKind } from '../../../../../types';

export const prerender = false;

const KINDS: ForumReactionKind[] = ['like', 'helpful', 'heart'];

export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập để bày tỏ cảm xúc.', 401);

  const body = await context.request.json().catch(() => ({}));
  if (isHoneypotTrapped(body)) return jsonError('Không thể gửi yêu cầu.', 400);

  const kind = String(body.kind || '') as ForumReactionKind;
  if (!KINDS.includes(kind)) return jsonError('Loại cảm xúc không hợp lệ.', 400);

  const limit = checkForumRateLimit(`forum-react:${user.id}`, 60, 60_000);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: 'Thao tác quá nhanh, thử lại sau.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) },
    });
  }

  try {
    const result = await db.toggleForumReaction({ postId: context.params.id || '', userId: user.id, kind });
    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.react.POST]', err);
    return jsonError(err?.message || 'Không thể cập nhật cảm xúc.', 500);
  }
};
