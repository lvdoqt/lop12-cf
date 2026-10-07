import type { APIRoute } from 'astro';
import { isUuid } from '../../../services/groupChat';
import { json, requireMember } from './_shared';

export const prerender = false;

// POST /api/nhom/comments — { postId, body }
export const POST: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;
  const { user, client } = auth;

  let payload: any;
  try { payload = await ctx.request.json(); } catch { return json({ error: 'JSON không hợp lệ' }, 400); }

  const postId = payload?.postId;
  const body = String(payload?.body || '').trim().slice(0, 2000);
  if (!isUuid(postId)) return json({ error: 'postId không hợp lệ' }, 400);
  if (!body) return json({ error: 'Bình luận trống' }, 400);

  const { data, error } = await client
    .from('group_comments')
    .insert({ post_id: postId, user_id: user.id, body })
    .select('id, created_at')
    .single();
  if (error) return json({ error: error.message }, 500);

  return json({ id: data.id, createdAt: data.created_at }, 201);
};
