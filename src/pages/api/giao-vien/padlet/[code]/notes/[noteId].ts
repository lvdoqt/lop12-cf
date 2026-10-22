import type { APIRoute } from 'astro';
import { padletKV, getPadletKV } from '../../../../../../lib/padletKV';

export const DELETE: APIRoute = async ({ params }) => {
  const { code, noteId } = params;
  if (!code || !noteId) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  }

  const kv = getPadletKV();
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not available' }), { status: 503 });
  }

  const ok = await padletKV.deleteNote(kv, code, noteId);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Không tìm thấy ghi chú' }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const { code, noteId } = params;
  if (!code || !noteId) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  }

  const kv = getPadletKV();
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not available' }), { status: 503 });
  }

  try {
    const body = await request.json();
    const updated = await padletKV.updateNote(kv, code, noteId, body);
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy ghi chú' }), { status: 404 });
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
