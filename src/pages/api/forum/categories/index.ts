import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';
import { generateForumSlug } from '../../../../services/db';

export const prerender = false;

function isStaff(user: any) {
  return user && (user.role === 'admin' || user.role === 'teacher');
}

/** GET /api/forum/categories — danh sách chuyên mục */
export const GET: APIRoute = async (_ctx) => {
  try {
    const categories = await db.getForumCategories();
    return new Response(JSON.stringify({ data: categories }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/** POST /api/forum/categories — tạo chuyên mục mới (admin/teacher) */
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!isStaff(user)) {
    return new Response(JSON.stringify({ error: 'Không có quyền.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await request.json();
    const { name, description, icon, subject_id, parent_id, order_index, is_active } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Tên chuyên mục không được để trống.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const slug = body.slug?.trim() || generateForumSlug(name.trim());
    const cat = await db.createForumCategory({
      name: name.trim(), slug, description: description?.trim() || undefined,
      icon: icon?.trim() || undefined, subject_id: subject_id || null,
      parent_id: parent_id || null,
      order_index: typeof order_index === 'number' ? order_index : undefined,
      is_active: is_active !== false,
    });
    return new Response(JSON.stringify({ data: cat }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
