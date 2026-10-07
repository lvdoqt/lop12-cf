import type { APIRoute } from 'astro';
import { isStaff, isUuid, removeImages } from '../../../../services/groupChat';
import { json, requireMember } from '../_shared';

export const prerender = false;

async function loadOwnedPost(client: any, id: string) {
  const { data, error } = await client.from('group_posts').select('id, user_id, images, pinned').eq('id', id).single();
  if (error || !data) return null;
  return data as { id: string; user_id: string; images: any[]; pinned: boolean };
}

// PATCH /api/nhom/posts/:id — { pinned: boolean } (tác giả hoặc giáo viên/admin)
export const PATCH: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;
  const { user, client } = auth;

  const id = ctx.params.id;
  if (!isUuid(id)) return json({ error: 'id không hợp lệ' }, 400);

  const post = await loadOwnedPost(client, id);
  if (!post) return json({ error: 'Không tìm thấy bài viết' }, 404);
  if (post.user_id !== user.id && !isStaff(user)) return json({ error: 'Không có quyền' }, 403);

  let payload: any = {};
  try { payload = await ctx.request.json(); } catch { /* empty */ }
  const pinned = typeof payload.pinned === 'boolean' ? payload.pinned : !post.pinned;

  const { error } = await client.from('group_posts').update({ pinned }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, pinned });
};

// DELETE /api/nhom/posts/:id — xoá bài + ảnh trên Storage
export const DELETE: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;
  const { user, client } = auth;

  const id = ctx.params.id;
  if (!isUuid(id)) return json({ error: 'id không hợp lệ' }, 400);

  const post = await loadOwnedPost(client, id);
  if (!post) return json({ error: 'Không tìm thấy bài viết' }, 404);
  if (post.user_id !== user.id && !isStaff(user)) return json({ error: 'Không có quyền' }, 403);

  const { error } = await client.from('group_posts').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);

  try { await removeImages(client, post.images); } catch { /* ignore storage cleanup errors */ }
  return json({ success: true });
};
