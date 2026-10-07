import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

// POST /api/admin/exams/generate — Generate exam from matrix criteria
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      duration,
      subject_id,
      category_id,
      exam_type,
      password,
      matrix,
    } = body;

    if (!title || !duration || !subject_id || !exam_type) {
      return new Response(JSON.stringify({
        error: 'Tiêu đề, thời gian, môn học và phân loại đề thi là bắt buộc.'
      }), { status: 400 });
    }

    const levels = matrix?.levels || { nb: 0, th: 0, vd: 0, vdc: 0 };
    const totalRequested = (Number(levels.nb) || 0) + (Number(levels.th) || 0) + (Number(levels.vd) || 0) + (Number(levels.vdc) || 0);

    if (totalRequested <= 0) {
      return new Response(JSON.stringify({
        error: 'Vui lòng chỉ định số lượng câu hỏi ít nhất cho 1 cấp độ nhận thức.'
      }), { status: 400 });
    }

    // Call matrix generator
    const matrixResult = await db.getQuestionsByMatrix({
      subjectId: subject_id,
      categoryId: category_id || null,
      chapter: matrix?.chapter || undefined,
      textbook: matrix?.textbook || undefined,
      levels: {
        nb: Number(levels.nb) || 0,
        th: Number(levels.th) || 0,
        vd: Number(levels.vd) || 0,
        vdc: Number(levels.vdc) || 0,
      },
      types: matrix?.types,
    });

    if (matrixResult.questions.length === 0) {
      return new Response(JSON.stringify({
        error: 'Ngân hàng câu hỏi hiện không có câu nào phù hợp với bộ lọc và ma trận đã chọn.'
      }), { status: 404 });
    }

    const questionIds = matrixResult.questions.map(q => q.id);

    // Create the exam
    const createdExam = await db.createExam(
      {
        title: title.trim(),
        duration: Number(duration),
        subject_id,
        category_id: category_id || null,
        exam_type,
        created_by: user.id,
        ...(password ? { password: String(password).trim() } : {}),
      },
      questionIds
    );

    return new Response(JSON.stringify({
      success: true,
      exam: createdExam,
      totalQuestions: matrixResult.questions.length,
      breakdown: matrixResult.breakdown,
      warnings: matrixResult.warnings,
    }), { status: 201 });

  } catch (err: any) {
    console.error('[/api/admin/exams/generate] error:', err);
    return new Response(JSON.stringify({
      error: err.message || 'Lỗi tạo đề thi theo ma trận.'
    }), { status: 500 });
  }
};
