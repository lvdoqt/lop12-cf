import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';

export const prerender = false;

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || !['admin', 'teacher'].includes(user.role)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });

  const course = await db.getCourseById(id);
  if (!course) return new Response('Not Found', { status: 404 });
  if (user.role === 'teacher' && course.created_by !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const statistics = await db.getCourseLearningStatistics(id);
  const header = ['STT', 'Họ tên', 'Email', 'Ngày đăng ký', 'Bài hoàn thành', 'Tỷ lệ hoàn thành', 'Quiz đã trả lời', 'Quiz đúng (lần gần nhất)', 'Tỷ lệ đúng quiz', 'Hoạt động gần nhất'];
  const rows = statistics.map((item, index) => {
    const student = item.enrollment.user;
    const enrolledAt = new Date(item.enrollment.enrolled_at).toLocaleString('vi-VN');
    const lastActivity = item.lastActivityAt ? new Date(item.lastActivityAt).toLocaleString('vi-VN') : '';
    return [
      index + 1,
      student?.fullname || '',
      student?.email || '',
      enrolledAt,
      `${item.completedLessons}/${item.totalLessons}`,
      `${item.completionPercent}%`,
      `${item.answeredQuizzes}/${item.totalQuizzes}`,
      `${item.correctQuizzes}/${item.answeredQuizzes}`,
      item.quizAccuracy === null ? '' : `${item.quizAccuracy}%`,
      lastActivity,
    ].map(csvCell).join(',');
  });

  const filename = `thong_ke_hoc_tap_${course.slug || course.id}.csv`;
  return new Response('\uFEFF' + header.map(csvCell).join(',') + '\r\n' + rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
};
