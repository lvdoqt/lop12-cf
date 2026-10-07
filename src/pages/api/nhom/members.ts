import type { APIRoute } from 'astro';
import { listMembers } from '../../../services/groupChat';
import { json, requireMember } from './_shared';

export const prerender = false;

// GET /api/nhom/members — danh sách thành viên đã đăng ký qua Supabase
export const GET: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;

  try {
    const members = await listMembers(auth.client);
    return json({ members });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
