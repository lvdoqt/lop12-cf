import type { APIRoute } from 'astro';
import { padletStore } from '../../../../../services/mockPadletStore';

export const POST: APIRoute = async ({ params, request }) => {
  const { code } = params;
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });
  }

  try {
    const body = await request.json();
    if (!body.content || typeof body.content !== 'string' || !body.content.trim()) {
      return new Response(JSON.stringify({ error: 'Nội dung ghi chú không được để trống' }), { status: 400 });
    }

    const note = padletStore.addNote(code, {
      author_name: body.author_name || 'Học sinh',
      title: body.title,
      content: body.content,
      color: body.color,
      column_id: body.column_id
    });

    if (!note) {
      return new Response(JSON.stringify({ error: 'Bảng đã bị khóa hoặc không tồn tại' }), { status: 400 });
    }

    return new Response(JSON.stringify(note), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};
