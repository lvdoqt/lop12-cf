import type { CourseLessonReviewQuestion } from '../types';

export type ImportedCourseQuiz = Omit<CourseLessonReviewQuestion, 'id' | 'lesson_id' | 'created_at'>;

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function parseOptions(question: any, index: number): string[] {
  const source = Array.isArray(question.options)
    ? question.options
    : OPTION_KEYS.map(key => question[`option_${key.toLowerCase()}`]).filter(value => value != null && value !== '');
  const options: string[] = source
    .map((option: any) => String(typeof option === 'string' ? option : option?.content ?? option?.text ?? '').trim())
    .filter(Boolean);
  if (options.length < 2 || options.length > OPTION_KEYS.length) {
    throw new Error(`Câu ${index + 1}: cần từ 2 đến ${OPTION_KEYS.length} đáp án.`);
  }
  if (new Set(options.map(option => option.toLocaleLowerCase('vi'))).size !== options.length) {
    throw new Error(`Câu ${index + 1}: các đáp án không được trùng nhau.`);
  }
  return options;
}

function parseDifficulty(value: unknown): 1 | 2 | 3 {
  const labels: Record<string, 1 | 2 | 3> = {
    easy: 1, medium: 2, hard: 3,
    'nhận biết': 1, 'thông hiểu': 2, 'vận dụng': 3,
  };
  const normalized = typeof value === 'string' ? labels[value.trim().toLocaleLowerCase('vi')] : Number(value);
  return normalized === 1 || normalized === 2 || normalized === 3 ? normalized : 2;
}

/** Parse the canonical /de-thi JSON shape plus the compact video-quiz shape. */
export function parseCourseQuizJson(raw: string): ImportedCourseQuiz[] {
  if (!raw.trim()) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`JSON quiz không hợp lệ: ${error.message}`);
  }

  const questions: any[] | null = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
      ? parsed.questions
      : Array.isArray(parsed?.quizzes)
        ? parsed.quizzes
        : null;
  if (!questions?.length) throw new Error('JSON cần có mảng "questions" và ít nhất một câu hỏi.');
  if (questions.length > 200) throw new Error('Mỗi bài học chỉ được import tối đa 200 câu quiz.');

  return questions.map((item: any, index: number): ImportedCourseQuiz => {
    const question = String(item.question ?? item.content ?? '').trim();
    if (!question) throw new Error(`Câu ${index + 1}: thiếu nội dung question.`);
    if (question.length > 5000) throw new Error(`Câu ${index + 1}: nội dung quá dài.`);

    const options = parseOptions(item, index);
    const answer = String(item.correct_option ?? item.correct_answer ?? item.answer ?? '').trim().toUpperCase();
    const validAnswers = OPTION_KEYS.slice(0, options.length);
    if (!validAnswers.includes(answer)) {
      throw new Error(`Câu ${index + 1}: correct_option phải là ${validAnswers.join(', ')}.`);
    }

    return {
      question,
      options,
      answer,
      explanation: String(item.explanation ?? '').trim() || null,
      knowledge_tag: String(item.knowledge_tag ?? item.topic ?? item.skill ?? item.category ?? 'Chưa phân loại').trim().slice(0, 120) || 'Chưa phân loại',
      difficulty: parseDifficulty(item.difficulty_level ?? item.difficulty),
      points: Number.isFinite(Number(item.points)) && Number(item.points) > 0 ? Number(item.points) : 1,
      order_index: Number.isInteger(Number(item.order_index)) ? Number(item.order_index) : index,
    };
  }).sort((a, b) => a.order_index - b.order_index)
    .map((quiz, index) => ({ ...quiz, order_index: index }));
}

export const COURSE_QUIZ_JSON_SAMPLE = JSON.stringify({
  questions: [
    {
      question: 'Hàm số đồng biến trên khoảng nào?',
      option_a: 'Khoảng $(0;1)$',
      option_b: 'Khoảng $(1;+\\infty)$',
      option_c: 'Toàn bộ $\\mathbb{R}$',
      option_d: 'Không có khoảng nào',
      correct_option: 'B',
      explanation: "Dựa vào dấu của $f'(x)$ trên từng khoảng.",
      knowledge_tag: 'Đạo hàm — tính đơn điệu',
      difficulty_level: 'medium'
    },
    {
      question: 'Điều kiện để hàm số nghịch biến là gì?',
      options: ["$f'(x) > 0$", "$f'(x) < 0$", "$f'(x) = 0$", "$f(x) > 0$"],
      answer: 'B',
      explanation: "$f'(x) < 0$ trên khoảng đang xét.",
      topic: 'Đạo hàm — tính đơn điệu',
      difficulty: 1
    }
  ]
}, null, 2);
