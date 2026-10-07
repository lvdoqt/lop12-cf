import type { APIRoute } from 'astro';
import { isUuid, REACTION_TYPES, type ReactionType } from '../../../services/groupChat';
import { json, requireMember } from './_shared';

export const prerender = false;

// POST /api/nhom/reactions — { postId, reaction } ; reaction = null để bỏ cảm xúc
export const POST: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;
  const { user, client } = auth;

  let payload: any;
  try { payload = await ctx.request.json(); } catch { return json({ error: 'JSON không hợp lệ' }, 400); }

  const postId = payload?.postId;
  const reaction = payload?.reaction as ReactionType | null;
  if (!isUuid(postId)) return json({ error: 'postId không hợp lệ' }, 400);

  if (reaction === null) {
    const { error } = await client.from('group_reactions').delete().eq('post_id', postId).eq('user_id', user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, reaction: null });
  }

  if (!REACTION_TYPES.includes(reaction)) return json({ error: 'reaction không hợp lệ' }, 400);

  const { error } = await client
    .from('group_reactions')
    .upsert({ post_id: postId, user_id: user.id, reaction }, { onConflict: 'post_id,user_id' });
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, reaction });
};
