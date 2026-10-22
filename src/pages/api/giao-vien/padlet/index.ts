import type { APIRoute } from 'astro';
import { padletStore } from '../../../../services/db';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const boards = await padletStore.getAllBoards(user.role === 'admin' ? undefined : user.id);
  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return new Response(JSON.stringify({ error: 'Tiêu đề bảng không được để trống' }), { status: 400 });
    }

    const board = await padletStore.createBoard({
      title: body.title,
      description: body.description,
      theme: body.theme,
      layout_mode: body.layout_mode,
      columns: Array.isArray(body.columns) ? body.columns : undefined,
      allow_comments: body.allow_comments,
      allow_likes: body.allow_likes,
      created_by: user.id
    });

    return new Response(JSON.stringify(board), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
