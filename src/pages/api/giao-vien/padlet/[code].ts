import type { APIRoute } from 'astro';
import { padletKV, getPadletKV } from '../../../../lib/padletKV';

export const GET: APIRoute = async ({ params }) => {
  const { code } = params;
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
  }

  const kv = getPadletKV();
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not available' }), { status: 503 });
  }

  const board = await padletKV.getBoardByCode(kv, code);
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

  const kv = getPadletKV();
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not available' }), { status: 503 });
  }

  try {
    const body = await request.json();
    const updated = await padletKV.updateBoard(kv, code, body, user.role === 'admin' ? undefined : user.id);
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

  const kv = getPadletKV();
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not available' }), { status: 503 });
  }

  const ok = await padletKV.deleteBoard(kv, code, user.role === 'admin' ? undefined : user.id);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Không thể xóa bảng' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
