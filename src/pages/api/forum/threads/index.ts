import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';
import { jsonError, requireForumUser } from '../../../../lib/forum-auth';
import { getForumEmbedding, toPgVector } from '../../../../lib/forum-embeddings';
import { checkForumRateLimit, isHoneypotTrapped } from '../../../../lib/forum-security';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const user = await requireForumUser(context);
    if (!user) return jsonError('Bạn cần đăng nhập để đăng bài.', 401);

    const body = await context.request.json();
    if (isHoneypotTrapped(body)) return jsonError('Không thể gửi bài viết.', 400);
    const rate = checkForumRateLimit(`forum-thread:${user.id}`, 5, 60_000);
    if (!rate.ok) return jsonError('Bạn đăng bài quá nhanh. Vui lòng đợi một lát.', 429);

    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    const categoryId = String(body.categoryId || '').trim();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 5)
      : [];

    if (title.length < 10 || title.length > 200) {
      return jsonError('Tiêu đề phải từ 10 đến 200 ký tự.');
    }
    if (text.length < 20 || text.length > 20_000) {
      return jsonError('Nội dung phải từ 20 đến 20.000 ký tự.');
    }
    if (!categoryId) return jsonError('Vui lòng chọn chuyên mục.');

    const categories = await db.getForumCategories();
    if (!categories.some(c => c.id === categoryId || c.slug === categoryId)) {
      return jsonError('Chuyên mục không hợp lệ.');
    }
    const category = categories.find(c => c.id === categoryId || c.slug === categoryId)!;

    // Phase 4: nhúng vector ngay khi đăng (best-effort, không chặn luồng đăng bài).
    const runtimeEnv = (context.locals as any).runtimeEnv as Record<string, string | undefined> | undefined;
    const embedding = await getForumEmbedding(`${title}\n${text}`, runtimeEnv);
    const summary = typeof body.summary === 'string' ? body.summary.slice(0, 600) : null;

    const thread = await db.createForumThread({
      categoryId: category.id,
      authorId: user.id,
      title,
      body: text,
      tags,
      isAnonymous: !!body.isAnonymous,
      summary,
      embedding: embedding ? toPgVector(embedding) : null,
    });

    return new Response(JSON.stringify({
      success: true,
      thread,
      url: `/forum/${category.slug}/${thread.slug}`,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[api.forum.threads.POST]', err);
    return jsonError(err?.message || 'Không thể đăng bài. Vui lòng thử lại.', 500);
  }
};
