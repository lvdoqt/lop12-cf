import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

/**
 * GET /api/classes/[id]/export-csv
 * Exports student results (exam attempts + course progress) as CSV.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const classId = params.id!;
  const cls = await db.getClassById(classId);
  if (!cls) return new Response('Class not found', { status: 404 });

  // Gather data
  const members = await db.getClassMembers(classId);
  const assignments = await db.getClassAssignments(classId);
  const allAttempts = await db.getAllAttempts();

  const examAssignments = assignments.filter(a => a.type === 'exam');
  const courseAssignments = assignments.filter(a => a.type === 'course');
  const materialAssignments = assignments.filter(a => a.type === 'material');

  // Fetch assignment views (materials & youtube)
  const allViews = await db.getClassAssignmentViews(classId);
  const viewMap = new Map<string, Map<string, { document_views: number; youtube_views: number; last_viewed_at: string }>>();
  for (const v of allViews) {
    if (!viewMap.has(v.user_id)) viewMap.set(v.user_id, new Map());
    viewMap.get(v.user_id)!.set(v.assignment_id, v);
  }

  // Build CSV rows
  const rows: string[] = [];

  // Header
  const examHeaders = examAssignments.map(a => `"${a.ref_title || a.ref_id} - Điểm","${a.ref_title || a.ref_id} - Ngày làm"`).join(',');
  const courseHeaders = courseAssignments.map(a => `"${a.ref_title || a.ref_id} - Tiến độ"`).join(',');
  const materialHeaders = materialAssignments.map(a => `"${a.ref_title || 'Tài liệu'} - Xem tài liệu","${a.ref_title || 'Tài liệu'} - Xem YouTube","${a.ref_title || 'Tài liệu'} - Lần xem cuối"`).join(',');
  
  const headerParts = ['STT', 'Họ và tên', 'Email'];
  if (examHeaders) headerParts.push(examHeaders);
  if (courseHeaders) headerParts.push(courseHeaders);
  if (materialHeaders) headerParts.push(materialHeaders);
  rows.push(headerParts.join(','));

  // Fetch enrollment data for courses
  let enrollmentMap: Map<string, Map<string, number>> = new Map(); // userId -> courseId -> progressPct
  for (const ca of courseAssignments) {
    const stats = await db.getCourseLearningStatistics(ca.ref_id);
    for (const stat of stats) {
      const uid = stat.enrollment.user_id;
      if (!enrollmentMap.has(uid)) enrollmentMap.set(uid, new Map());
      enrollmentMap.get(uid)!.set(ca.ref_id, stat.completionPercent);
    }
  }

  // Data rows
  members.forEach((m, idx) => {
    const name = `"${m.user?.fullname || ''}"`;
    const email = `"${m.user?.email || ''}"`;
    const parts = [`${idx + 1}`, name, email];

    for (const ea of examAssignments) {
      const attempt = allAttempts
        .filter(a => a.user_id === m.user_id && a.exam_id === ea.ref_id && a.finished_at)
        .sort((a, b) => new Date(b.finished_at!).getTime() - new Date(a.finished_at!).getTime())[0];
      if (attempt) {
        const score = attempt.score !== null ? attempt.score.toFixed(1) : '';
        const date = attempt.finished_at ? new Date(attempt.finished_at).toLocaleDateString('vi-VN') : '';
        parts.push(`"${score}"`, `"${date}"`);
      } else {
        parts.push('"Chưa làm"', '""');
      }
    }

    for (const ca of courseAssignments) {
      const pct = enrollmentMap.get(m.user_id)?.get(ca.ref_id);
      parts.push(`"${pct !== undefined ? pct + '%' : 'Chưa học'}"`);
    }

    for (const ma of materialAssignments) {
      const v = viewMap.get(m.user_id)?.get(ma.id);
      if (v) {
        const docText = v.document_views > 0 ? `Đã xem (${v.document_views} lần)` : 'Chưa xem';
        const ytText = v.youtube_views > 0 ? `Đã xem (${v.youtube_views} lần)` : 'Chưa xem';
        const dateText = v.last_viewed_at ? new Date(v.last_viewed_at).toLocaleDateString('vi-VN') : '';
        parts.push(`"${docText}"`, `"${ytText}"`, `"${dateText}"`);
      } else {
        parts.push('"Chưa xem"', '"Chưa xem"', '""');
      }
    }

    rows.push(parts.join(','));
  });

  const csv = '\uFEFF' + rows.join('\r\n'); // BOM for Excel UTF-8
  const fileName = `ket-qua-${cls.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
};
