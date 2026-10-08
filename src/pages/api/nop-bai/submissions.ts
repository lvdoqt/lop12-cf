import type { APIRoute } from 'astro';
import {
  getNopBaiAdminClient,
  listSubmissions,
  deleteSubmission,
} from '../../../services/nopBai';

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/nop-bai/submissions — Lấy danh sách bài nộp
export const GET: APIRoute = async (ctx) => {
  try {
    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);
    const user = ctx.locals.user;
    const isManaged = ctx.url.searchParams.get('managed') === 'true';

    const className = ctx.url.searchParams.get('class') || undefined;
    const search = ctx.url.searchParams.get('search') || undefined;

    let allowedClassNames: string[] | undefined = undefined;
    if (isManaged && user && user.role === 'teacher') {
      const { getClasses } = await import('../../../services/nopBai');
      const teacherClasses = await getClasses(client, { teacherId: user.id });
      allowedClassNames = teacherClasses.map(c => c.name);
    }

    const submissions = await listSubmissions(client, { className, search, allowedClassNames });
    return json({ submissions, total: submissions.length });
  } catch (error: any) {
    return json({ error: error.message || 'Lỗi lấy bài nộp' }, 500);
  }
};

// DELETE /api/nop-bai/submissions — Xóa bài nộp (Admin / Teacher)
export const DELETE: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return json({ error: 'Chỉ giáo viên và admin mới được xóa bài nộp' }, 403);
  }

  try {
    const id = ctx.url.searchParams.get('id');
    if (!id) return json({ error: 'Thiếu ID bài nộp' }, 400);

    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);

    let allowedClassNames: string[] | undefined = undefined;
    if (user.role === 'teacher') {
      const { getClasses } = await import('../../../services/nopBai');
      const teacherClasses = await getClasses(client, { teacherId: user.id });
      allowedClassNames = teacherClasses.map(c => c.name);
    }

    await deleteSubmission(client, id, { id: user.id, role: user.role, allowedClassNames });
    return json({ success: true, message: 'Đã xóa bài nộp thành công' });
  } catch (error: any) {
    const status = error.message?.includes('quyền') ? 403 : 400;
    return json({ error: error.message || 'Lỗi xóa bài nộp' }, status);
  }
};
