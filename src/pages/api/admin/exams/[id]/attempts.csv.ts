import type { APIRoute } from 'astro';
import { db } from '../../../../../services/db';
import { uuidToSeed, mulberry32 } from '../../../../../lib/random';
import { buildShuffledExam } from '../../../../../lib/exam';

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
  const allQuestions = await db.getQuestionsByExamId(id);
  const examQuestionCounts = await db.getExamQuestionCounts([id]);
  const fallbackTotalQuestions = examQuestionCounts[id] || allQuestions.length || 0;

  const isVsat = exam.exam_type === 'vsat';
  const header = isVsat
    ? 'STT,Ho ten,Lop,Email,Diem tho (150),Diem nang luc IRT,So lan roi tab,Thoi gian lam (phut),Ngay nop\r\n'
    : 'STT,Ho ten,Lop,Email,Diem,So cau dung,Tong cau,% dung,So lan roi tab,Thoi gian lam (phut),Ngay nop\r\n';

  const rows = attempts.map((attempt, idx) => {
    const userObj = attempt.user as any;
    const name = (attempt.student_name || userObj?.fullname || 'Học sinh').replace(/,/g, ' ');
    const studentClass = (attempt.student_class || '').replace(/,/g, ' ');
    const email = (userObj?.email || '').replace(/,/g, ' ');
    const tabSwitches = attempt.tab_switches ?? 0;
    const score = attempt.score !== null && attempt.score !== undefined ? attempt.score.toFixed(2) : '';

    // Xác định chính xác số câu hỏi mà học sinh này thực tế nhận trong đề thi
    let studentTotalQuestions = 0;
    if (allQuestions.length > 0) {
      const prng = mulberry32(uuidToSeed(attempt.id));
      const attemptQuestions = buildShuffledExam(allQuestions, prng, exam.settings);
      attemptQuestions.forEach((q) => {
        if (q.type === 'read' || q.type === 'list' || q.type === 'read_cloze' || q.type === 'cloze_text') {
          const subs = (q.metadata as any)?.questions || [];
          studentTotalQuestions += subs.length || 1;
        } else {
          studentTotalQuestions += 1;
        }
      });
    }

    if (studentTotalQuestions === 0) {
      const pickPerType = exam.settings?.pick_per_type;
      if (pickPerType && typeof pickPerType === 'object') {
        studentTotalQuestions = Object.values(pickPerType).reduce((sum, v) => sum + (Number(v) || 0), 0);
      }
      if (studentTotalQuestions === 0) {
        studentTotalQuestions = fallbackTotalQuestions;
      }
    }

    // Điểm/câu từ settings (mặc định 0.25)
    const ppq = exam.settings?.point_per_question ?? 0.25;
    const correctRaw = attempt.score !== null && attempt.score !== undefined
      ? Math.round(attempt.score / ppq)
      : null;
    const correct = correctRaw !== null
      ? (studentTotalQuestions > 0 ? Math.min(correctRaw, studentTotalQuestions) : correctRaw)
      : '';

    // % đúng dựa trên tổng số câu thực tế học sinh làm (ví dụ 10 câu thay vì 60 câu trong ngân hàng)
    const pctCorrect = (typeof correct === 'number' && studentTotalQuestions > 0)
      ? ((correct / studentTotalQuestions) * 100).toFixed(1) + '%'
      : '';

    const durationMs = attempt.finished_at && attempt.started_at
      ? new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime()
      : null;
    const durationMin = durationMs !== null ? (durationMs / 60000).toFixed(1) : '';
    const finishedAt = attempt.finished_at
      ? new Date(attempt.finished_at).toLocaleString('vi-VN')
      : '';
    return isVsat
      ? `${idx + 1},"${name}","${studentClass}","${email}",${score},${attempt.ability_score ?? ''},${tabSwitches},${durationMin},"${finishedAt}"`
      : `${idx + 1},"${name}","${studentClass}","${email}",${score},${correct},${studentTotalQuestions},"${pctCorrect}",${tabSwitches},${durationMin},"${finishedAt}"`;
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
