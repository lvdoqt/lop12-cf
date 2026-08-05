import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });

  const course = await db.getCourseById(id);
  if (!course) return new Response('Not Found', { status: 404 });

  if (user.role === 'teacher' && course.created_by !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const enrollments = await db.getCourseEnrollments(id);

  const header = 'STT,Ho ten,Email,Vai tro,Ngay dang ky\r\n';

  const rows = enrollments.map((enr, idx) => {
    const userObj = enr.user as any;
    const name = (userObj?.fullname || '').replace(/,/g, ' ');
    const email = (userObj?.email || '').replace(/,/g, ' ');
    const role = userObj?.role === 'admin' ? 'Admin' : userObj?.role === 'teacher' ? 'Giao vien' : 'Hoc sinh';
    const enrolledAt = enr.enrolled_at
      ? new Date(enr.enrolled_at).toLocaleString('vi-VN')
      : '';
    return `${idx + 1},"${name}","${email}","${role}","${enrolledAt}"`;
  });

  const courseTitle = course.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 40);
  const filename = `hoc_sinh_khoa_${courseTitle}.csv`;

  return new Response('\uFEFF' + header + rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  });
};