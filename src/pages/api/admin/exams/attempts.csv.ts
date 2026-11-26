import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isAdmin = user.role === 'admin';
  const filterExamId = url.searchParams.get('exam_id') || undefined;

  // Lấy toàn bộ attempts
  let allAttempts = await db.getAllAttempts();

  // Chỉ lấy bài thi đã hoàn thành (finished_at != null)
  allAttempts = allAttempts.filter(a => a.finished_at !== null);

  // Nếu là giáo viên (không phải admin), chỉ lấy các đề do chính giáo viên đó tạo
  if (!isAdmin) {
    allAttempts = allAttempts.filter(a => a.exam?.created_by === user.id);
  }

  // Nếu có lọc theo exam_id
  if (filterExamId) {
    allAttempts = allAttempts.filter(a => a.exam_id === filterExamId);
  }

  // Lấy số câu hỏi theo từng đề (để tính % đúng)
  const uniqueExamIds = [...new Set(allAttempts.map(a => a.exam_id).filter(Boolean))];
  const examQuestionCounts = uniqueExamIds.length > 0
    ? await db.getExamQuestionCounts(uniqueExamIds)
    : {};

  const header = 'So bao danh (STT),Ten de thi,Mon hoc,Ho ten,Lop,Email,Diem,So cau dung,Tong cau,% dung,Diem tho (150),Diem nang luc IRT,So lan roi tab,Thoi gian lam (phut),Ngay nop\r\n';

  const rows = allAttempts.map((attempt, idx) => {
    const examObj = attempt.exam as any;
    const userObj = attempt.user as any;
    const sbd = (attempt.student_sbd || String(idx + 1)).replace(/"/g, '""').replace(/,/g, ' ');
    const examTitle = (examObj?.title || 'Đề thi').replace(/,/g, ' ');
    const subjectName = (examObj?.subject?.name || '—').replace(/,/g, ' ');
    const studentName = (attempt.student_name || userObj?.fullname || 'Học sinh').replace(/,/g, ' ');
    const studentClass = (attempt.student_class || '').replace(/,/g, ' ');
    const email = (userObj?.email || '').replace(/,/g, ' ');
    const tabSwitches = attempt.tab_switches ?? 0;
    const score = attempt.score !== null && attempt.score !== undefined ? Number(attempt.score).toFixed(2) : '';
    const rawScore = attempt.raw_score !== null && attempt.raw_score !== undefined ? Number(attempt.raw_score).toFixed(2) : '';
    const abilityScore = attempt.ability_score !== null && attempt.ability_score !== undefined ? String(attempt.ability_score) : '';

    // Số câu hỏi thực tế (đã tính theo cấu hình rút k/n câu pick_per_type)
    const effectiveTotalQ = examQuestionCounts[attempt.exam_id] || 0;

    // % đúng (dùng point_per_question nếu có, mặc định 0.25)
    const ppq = (examObj?.settings?.point_per_question ?? 0.25) as number;
    const correctRaw = attempt.score !== null && attempt.score !== undefined && ppq > 0
      ? Math.round(Number(attempt.score) / ppq)
      : null;
    const correct = correctRaw !== null
      ? (effectiveTotalQ > 0 ? Math.min(correctRaw, effectiveTotalQ) : correctRaw)
      : '';
    const pctCorrect = (typeof correct === 'number' && effectiveTotalQ > 0)
      ? ((correct / effectiveTotalQ) * 100).toFixed(1) + '%'
      : '';

    const durationMs = attempt.finished_at && attempt.started_at
      ? new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime()
      : null;
    const durationMin = durationMs !== null ? (durationMs / 60000).toFixed(1) : '';
    const targetDate = attempt.finished_at || attempt.started_at;
    const finishedAt = targetDate
      ? new Date(targetDate).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
      : '';

    return `"${sbd}","${examTitle}","${subjectName}","${studentName}","${studentClass}","${email}",${score},${correct},${effectiveTotalQ},"${pctCorrect}",${rawScore},${abilityScore},${tabSwitches},${durationMin},"${finishedAt}"`;
  });

  const nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const filename = `danh_sach_hoc_sinh_lam_bai_${nowStr}.csv`;

  return new Response('\uFEFF' + header + rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  });
};
