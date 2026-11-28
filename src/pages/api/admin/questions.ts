import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subject_id') || undefined;
    const categoryId = url.searchParams.get('category_id') || undefined;
    const type = url.searchParams.get('type') || undefined;
    const difficulty = url.searchParams.get('difficulty') || undefined;
    const search = url.searchParams.get('q') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));

    const result = await db.getQuestionsPaginated({
      subjectId,
      categoryId,
      type,
      difficulty,
      search,
      createdBy: user.role === 'admin' ? undefined : user.id,
      page,
      limit,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Không thể tải danh sách câu hỏi.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
