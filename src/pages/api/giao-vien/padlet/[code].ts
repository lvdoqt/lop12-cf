import type { APIRoute } from 'astro';
import { padletStore } from '../../../../services/db';

export const GET: APIRoute = async ({ params }) => {
  const { code } = params;
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
  }

  const board = await padletStore.getBoardByCode(code);
  if (!board) {
    return new Response(JSON.stringify({ error: 'Không tìm thấy bảng' }), { status: 404 });
  }

  return new Response(JSON.stringify(board), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { code } = params;
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await padletStore.updateBoard(code, body, user.role === 'admin' ? undefined : user.id);
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy bảng hoặc không có quyền' }), { status: 404 });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { code } = params;
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
  }

  const ok = await padletStore.deleteBoard(code, user.role === 'admin' ? undefined : user.id);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Không thể xóa bảng' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
