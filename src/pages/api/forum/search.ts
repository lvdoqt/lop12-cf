import type { APIRoute } from 'astro';
import { db } from '../../../services/db';
import { getForumEmbedding } from '../../../lib/forum-embeddings';
import { jsonError } from '../../../lib/forum-auth';

export const prerender = false;

/** Tìm kiếm ngữ nghĩa: pgvector khi có GEMINI_API_KEY, otherwise tag/từ khoá. */
export const GET: APIRoute = async (context) => {
  const q = (context.url.searchParams.get('q') || '').trim();
  if (q.length < 3) return jsonError('Nhập ít nhất 3 ký tự để tìm kiếm.', 400);

  const categoryId = context.url.searchParams.get('category') || null;
  const excludeId = context.url.searchParams.get('exclude') || null;
  const limit = Math.min(20, Math.max(1, Number(context.url.searchParams.get('limit')) || 6));
  const runtimeEnv = (context.locals as any).runtimeEnv as Record<string, string | undefined> | undefined;

  try {
    const embedding = await getForumEmbedding(q, runtimeEnv, 'RETRIEVAL_QUERY');
    if (embedding) {
      const threads = await db.searchForumThreadsByEmbedding(embedding, { limit, categoryId, excludeId });
      if (threads.length) {
        return new Response(JSON.stringify({ success: true, semantic: true, threads }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    const threads = await db.searchForumThreadsByText(q, {
      categoryId: categoryId || undefined,
      search: q,
      limit,
    }, limit);
    return new Response(JSON.stringify({ success: true, semantic: false, threads }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.search.GET]', err);
    return jsonError(err?.message || 'Không thể tìm kiếm.', 500);
  }
};
