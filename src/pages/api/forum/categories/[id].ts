import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

function isStaff(user: any) {
  return user && (user.role === 'admin' || user.role === 'teacher');
}

/** PUT /api/forum/categories/[id] — cập nhật chuyên mục */
export const PUT: APIRoute = async ({ locals, request, params }) => {
  const user = locals.user;
  if (!isStaff(user)) {
    return new Response(JSON.stringify({ error: 'Không có quyền.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const id = params.id!;
  try {
    const body = await request.json();
    const { name, slug, description, icon, subject_id, parent_id, order_index, is_active } = body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (subject_id !== undefined) updateData.subject_id = subject_id;
    if (parent_id !== undefined) updateData.parent_id = parent_id;
    if (order_index !== undefined) updateData.order_index = order_index;
    if (is_active !== undefined) updateData.is_active = is_active;
    const cat = await db.updateForumCategory(id, updateData);
    return new Response(JSON.stringify({ data: cat }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

/** DELETE /api/forum/categories/[id] — xóa chuyên mục */
export const DELETE: APIRoute = async ({ locals, params }) => {
  const user = locals.user;
  if (!isStaff(user)) {
    return new Response(JSON.stringify({ error: 'Không có quyền.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  const id = params.id!;
  try {
    await db.deleteForumCategory(id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
