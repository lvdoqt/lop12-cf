import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { blog_id, content } = body;

    if (!blog_id || !content || content.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Nội dung bình luận không hợp lệ.' }), { status: 400 });
    }

    const userId = cookies.get('mock-user-id')?.value;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Bạn cần đăng nhập để bình luận.' }), { status: 401 });
    }

    const comment = await db.createComment({
      blog_id,
      user_id: userId,
      content: content.trim()
    });

    return new Response(JSON.stringify({ success: true, comment }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Lỗi gửi bình luận.' }), { status: 500 });
  }
};