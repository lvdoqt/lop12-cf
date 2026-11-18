import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';
import { jsonError, requireForumUser } from '../../../../lib/forum-auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập.', 401);

  const unreadOnly = context.url.searchParams.get('unread') === '1';
  const limit = Math.min(50, Math.max(1, Number(context.url.searchParams.get('limit')) || 20));
  const [notifications, unreadCount] = await Promise.all([
    db.getForumNotifications(user.id, unreadOnly, limit),
    db.getUnreadForumNotificationCount(user.id),
  ]);

  return new Response(JSON.stringify({ success: true, notifications, unreadCount }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
