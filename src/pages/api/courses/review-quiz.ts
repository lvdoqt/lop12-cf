import type { APIRoute } from 'astro';
import { db } from '../../../services/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return Response.json({ error: 'Bạn cần đăng nhập để làm quiz.' }, { status: 401 });

  try {
    const body = await request.json();
    const lessonId = typeof body.lessonId === 'string' ? body.lessonId : '';
    const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
      ? body.answers as Record<string, unknown>
      : null;
    if (!lessonId || !answers) return Response.json({ error: 'Dữ liệu bài làm không hợp lệ.' }, { status: 400 });

    const lesson = await db.getCourseLessonById(lessonId);
    if (!lesson) return Response.json({ error: 'Không tìm thấy bài học.' }, { status: 404 });
    if (!await db.isUserEnrolled(lesson.course_id, user.id)) {
      return Response.json({ error: 'Bạn chưa đăng ký khóa học này.' }, { status: 403 });
    }

    const questions = await db.getLessonReviewQuestions(lessonId);
    if (!questions.length) return Response.json({ error: 'Bài học chưa có quiz ôn tập.' }, { status: 404 });
    const normalizedAnswers: Record<string, string> = {};
    for (const question of questions) {
      const answer = String(answers[question.id] || '').trim().toUpperCase();
      const valid = question.options.map((_, index) => String.fromCharCode(65 + index));
      if (!valid.includes(answer)) {
        return Response.json({ error: 'Vui lòng trả lời đầy đủ tất cả câu hỏi.' }, { status: 400 });
      }
      normalizedAnswers[question.id] = answer;
    }

    const attempt = await db.submitLessonReviewQuiz(lessonId, user.id, normalizedAnswers);
    const results = questions.map(question => ({
      questionId: question.id,
      selectedAnswer: normalizedAnswers[question.id],
      correctAnswer: question.answer,
      isCorrect: normalizedAnswers[question.id] === question.answer,
      explanation: question.explanation,
      knowledgeTag: question.knowledge_tag,
    }));
    return Response.json({ attempt, results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Không thể chấm bài.' }, { status: 500 });
  }
};
