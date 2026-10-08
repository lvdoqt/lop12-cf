import type { APIRoute } from 'astro';
import {
  getNopBaiAdminClient,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
} from '../../../services/nopBai';

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/nop-bai/classes — Lấy danh sách lớp học
export const GET: APIRoute = async (ctx) => {
  try {
    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);
    const user = ctx.locals.user;
    const isManaged = ctx.url.searchParams.get('managed') === 'true';

    let classes;
    if (isManaged && user) {
      if (user.role === 'teacher') {
        classes = await getClasses(client, { teacherId: user.id });
      } else if (user.role === 'admin') {
        classes = await getClasses(client, { isAdmin: true });
      } else {
        classes = await getClasses(client);
      }
    } else {
      classes = await getClasses(client);
    }

    return json({ classes });
  } catch (error: any) {
    return json({ error: error.message || 'Lỗi lấy danh sách lớp học' }, 500);
  }
};

// POST /api/nop-bai/classes — Thêm lớp mới (Admin / Teacher)
export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return json({ error: 'Chỉ giáo viên và quản trị viên mới được tạo lớp' }, 403);
  }

  try {
    const body = await ctx.request.json().catch(() => ({}));
    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);

    const newClass = await createClass(client, {
      name: body.name,
      grade: body.grade,
      speciality: body.speciality,
      color: body.color,
      pinnedNotice: body.pinnedNotice,
      userId: user.id,
      userName: user.fullname || user.email || null,
    });

    return json({ success: true, class: newClass }, 201);
  } catch (error: any) {
    return json({ error: error.message || 'Lỗi tạo lớp học' }, 400);
  }
};

// PUT /api/nop-bai/classes — Sửa thông tin lớp (Admin / Teacher)
export const PUT: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return json({ error: 'Không có quyền sửa lớp' }, 403);
  }

  try {
    const body = await ctx.request.json().catch(() => ({}));
    if (!body.id) return json({ error: 'Thiếu ID lớp' }, 400);

    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);

    await updateClass(
      client,
      body.id,
      {
        name: body.name,
        grade: body.grade,
        speciality: body.speciality,
        color: body.color,
        pinnedNotice: body.pinnedNotice,
      },
      { id: user.id, role: user.role }
    );

    return json({ success: true, message: 'Đã cập nhật lớp thành công' });
  } catch (error: any) {
    const status = error.message?.includes('quyền') ? 403 : 400;
    return json({ error: error.message || 'Lỗi cập nhật lớp' }, status);
  }
};

// DELETE /api/nop-bai/classes — Xóa lớp (Admin / Teacher)
export const DELETE: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return json({ error: 'Không có quyền xóa lớp' }, 403);
  }

  try {
    const id = ctx.url.searchParams.get('id');
    if (!id) return json({ error: 'Thiếu ID lớp cần xóa' }, 400);

    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);

    await deleteClass(client, id, { id: user.id, role: user.role });
    return json({ success: true, message: 'Đã xóa lớp thành công' });
  } catch (error: any) {
    const status = error.message?.includes('quyền') ? 403 : 400;
    return json({ error: error.message || 'Lỗi xóa lớp' }, status);
  }
};
