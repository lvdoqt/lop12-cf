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

  const exam = await db.getExamById(id);
  if (!exam) return new Response('Not Found', { status: 404 });

  if (user.role === 'teacher' && exam.created_by !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const attempts = await db.getAttemptsByExamId(id);
  const examQuestionCounts = await db.getExamQuestionCounts([id]);
  const totalQuestions = examQuestionCounts[id] || 0;

  const isVsat = exam.exam_type === 'vsat';
  const header = isVsat
    ? 'STT,Ho ten,Email,Diem tho (150),Diem nang luc IRT,Thoi gian lam (phut),Ngay nop\r\n'
    : 'STT,Ho ten,Email,Diem,So cau dung,Tong cau,Thoi gian lam (phut),Ngay nop\r\n';

  const rows = attempts.map((attempt, idx) => {
    const userObj = attempt.user as any;
    const name = (userObj?.fullname || '').replace(/,/g, ' ');
    const email = (userObj?.email || '').replace(/,/g, ' ');
    const score = attempt.score !== null && attempt.score !== undefined ? attempt.score.toFixed(2) : '';
    // score = so_cau_dung × 0.25, nen so_cau_dung = score × 4
    const correctRaw = attempt.score !== null && attempt.score !== undefined
      ? Math.round(attempt.score * 4)
      : null;
    const correct = correctRaw !== null
      ? (totalQuestions > 0 ? Math.min(correctRaw, totalQuestions) : correctRaw)
      : '';
    const durationMs = attempt.finished_at && attempt.started_at
      ? new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime()
      : null;
    const durationMin = durationMs !== null ? (durationMs / 60000).toFixed(1) : '';
    const finishedAt = attempt.finished_at
      ? new Date(attempt.finished_at).toLocaleString('vi-VN')
      : '';
    return isVsat
      ? `${idx + 1},"${name}","${email}",${score},${attempt.ability_score ?? ''},${durationMin},"${finishedAt}"`
      : `${idx + 1},"${name}","${email}",${score},${correct},${totalQuestions},${durationMin},"${finishedAt}"`;
  });

  const examTitle = exam.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 40);
  const filename = `hoc_sinh_de_${examTitle}.csv`;

  return new Response('\uFEFF' + header + rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  });
};
