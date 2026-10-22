import type { APIRoute } from 'astro';
import { padletKV, getPadletKV } from '../../../../../../../lib/padletKV';

export const POST: APIRoute = async ({ params }) => {
  const { code, noteId } = params;
  if (!code || !noteId) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  }

  const kv = getPadletKV();
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not available' }), { status: 503 });
  }

  const result = await padletKV.toggleLike(kv, code, noteId);
  if (!result) {
    return new Response(JSON.stringify({ error: 'Không thể thả tim hoặc tính năng bị tắt' }), { status: 400 });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
