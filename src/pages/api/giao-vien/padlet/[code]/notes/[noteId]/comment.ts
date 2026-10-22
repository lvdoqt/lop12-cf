import type { APIRoute } from 'astro';
import { padletStore } from '../../../../../../../services/db';

export const POST: APIRoute = async ({ params, request }) => {
  const { code, noteId } = params;
  if (!code || !noteId) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  }

  try {
    const body = await request.json();
    if (!body.content || typeof body.content !== 'string' || !body.content.trim()) {
      return new Response(JSON.stringify({ error: 'Nội dung bình luận không được để trống' }), { status: 400 });
    }

    const comment = await padletStore.addComment(
      code,
      noteId,
      body.author_name || 'Học sinh',
      body.content
    );

    if (!comment) {
      return new Response(JSON.stringify({ error: 'Không thể bình luận (bảng đã khóa hoặc tính năng bị tắt)' }), { status: 400 });
    }

    return new Response(JSON.stringify(comment), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
