import { shuffleArrayWithPRNG } from './random';
import { instantiateDynamicQuestion } from './dynamic-quiz';
import type { Question, Answer, ExamSettings, Exam, Subject, ExamProgram, ShowAnswersMode } from '../types';

export type ExamQuestion = Question & { answers: Answer[] };

export const QUESTION_TYPE_LABELS_VI: Record<string, string> = {
  mcq: 'TN 4 lựa chọn',
  single_choice: 'TN 4 lựa chọn',
  multiple_choice: 'Chọn nhiều đáp án',
  msq: 'Đúng/Sai 4 ý',
  true_false: 'Đúng/Sai đơn',
  sa: 'Trả lời ngắn',
  tl: 'Tự luận',
  read: 'Đọc hiểu',
  read_cloze: 'Đọc điền khuyết',
  cloze_text: 'Điền một từ',
  ordering: 'Sắp xếp câu/đoạn',
  matching: 'Ghép cặp',
  list: 'Kỹ năng nghe',
};

export function getQuestionTypeLabelVi(type?: string | null): string {
  const key = String(type || 'mcq').toLowerCase().trim();
  return QUESTION_TYPE_LABELS_VI[key] || 'TN 4 lựa chọn';
}

export interface ExamProgramMeta {
  key: ExamProgram;
  dbType: Exam['exam_type'];
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  defaultMaxScore: number;
}

export const EXAM_PROGRAM_META: Record<ExamProgram, ExamProgramMeta> = {
  '15m': {
    key: '15m',
    dbType: '15m',
    label: 'Đánh giá thường xuyên (15 phút)',
    shortLabel: 'ĐĐGtx 15p',
    icon: '⏱️',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/70 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800/50',
    defaultMaxScore: 10,
  },
  midterm: {
    key: 'midterm',
    dbType: '45m',
    label: 'Kiểm tra Giữa kỳ (CV 7991)',
    shortLabel: 'Giữa kỳ',
    icon: '📝',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50',
    defaultMaxScore: 10,
  },
  '45m': {
    key: '45m',
    dbType: '45m',
    label: 'Kiểm tra Giữa kỳ (CV 7991)',
    shortLabel: 'Giữa kỳ',
    icon: '📝',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50',
    defaultMaxScore: 10,
  },
  semester: {
    key: 'semester',
    dbType: 'semester',
    label: 'Kiểm tra Cuối học kỳ (CV 7991)',
    shortLabel: 'Cuối kỳ',
    icon: '🎓',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/70 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50',
    defaultMaxScore: 10,
  },
  mock_thpt: {
    key: 'mock_thpt',
    dbType: 'mock_thpt',
    label: 'Thi thử Tốt nghiệp THPT (Chuẩn 2025)',
    shortLabel: 'Thi thử THPT',
    icon: '🏆',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/50',
    defaultMaxScore: 10,
  },
  dgnl_hsa: {
    key: 'dgnl_hsa',
    dbType: 'mock_thpt',
    label: 'ĐGNL ĐHQG Hà Nội (HSA)',
    shortLabel: 'ĐGNL HSA',
    icon: '🧠',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/50',
    defaultMaxScore: 150,
  },
  dgnl_vact: {
    key: 'dgnl_vact',
    dbType: 'mock_thpt',
    label: 'ĐGNL ĐHQG TP.HCM (V-ACT)',
    shortLabel: 'ĐGNL V-ACT',
    icon: '🎯',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/70 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800/50',
    defaultMaxScore: 120,
  },
  dgtd_tsa: {
    key: 'dgtd_tsa',
    dbType: 'mock_thpt',
    label: 'ĐGTD ĐH Bách Khoa (TSA)',
    shortLabel: 'ĐGTD TSA',
    icon: '🔬',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/70 dark:bg-fuchsia-950/30 dark:text-fuchsia-300 dark:border-fuchsia-800/50',
    defaultMaxScore: 100,
  },
  vsat: {
    key: 'vsat',
    dbType: 'vsat',
    label: 'Đánh giá năng lực V-SAT',
    shortLabel: 'Thi V-SAT',
    icon: '🎯',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50',
    defaultMaxScore: 150,
  },
  hsg: {
    key: 'hsg',
    dbType: 'semester',
    label: 'Thi Học sinh giỏi (Thang 20đ)',
    shortLabel: 'Đề HSG',
    icon: '🥇',
    badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-300/70 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800/50',
    defaultMaxScore: 20,
  },
};

export function getExamProgramKey(exam: Pick<Exam, 'exam_type' | 'settings'>): ExamProgram {
  const prog = exam.settings?.exam_program;
  if (prog && EXAM_PROGRAM_META[prog]) {
    return prog;
  }
  if (exam.exam_type === '45m') return 'midterm';
  return (exam.exam_type as ExamProgram) || 'mock_thpt';
}

export function getExamProgramMeta(exam: Pick<Exam, 'exam_type' | 'settings'>): ExamProgramMeta {
  return EXAM_PROGRAM_META[getExamProgramKey(exam)] || EXAM_PROGRAM_META.mock_thpt;
}

export function mapProgramToDbExamType(program: string): Exam['exam_type'] {
  const meta = EXAM_PROGRAM_META[program as ExamProgram];
  if (meta) return meta.dbType;
  if (program === '15m' || program === '45m' || program === 'semester' || program === 'mock_thpt' || program === 'vsat') {
    return program;
  }
  return 'mock_thpt';
}

function isMathSubject(subject?: Pick<Subject, 'name' | 'slug'> | null): boolean {
  if (!subject) return false;
  const raw = `${subject.slug || ''} ${subject.name || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return raw.includes('toan');
}

/**
 * Resolves accurate per-question points & max scale score according to Vietnamese exam rules.
 * Fixes the trap where non-Math subjects (Physics, Chemistry, Biology, Geography, Informatics, etc.)
 * must default to 0.25 points per short-answer (`sa`) question in THPT 2025 instead of 0.5.
 */
export function getEffectiveExamScoring(
  exam: Pick<Exam, 'exam_type' | 'settings'> & { subject?: Pick<Subject, 'name' | 'slug'> | null }
): {
  isVsat: boolean;
  pointPerQuestion: number;
  pointPerSa: number;
  maxScore: number;
} {
  const isVsat = exam.exam_type === 'vsat';
  if (isVsat) {
    return {
      isVsat: true,
      pointPerQuestion: 6,
      pointPerSa: 6,
      maxScore: 150,
    };
  }

  const progMeta = getExamProgramMeta(exam);
  const defaultPpq = progMeta.key === 'dgnl_hsa' || progMeta.key === 'dgtd_tsa' ? 1 : (progMeta.key === 'hsg' ? 0.5 : 0.25);
  const defaultPpSa =
    progMeta.key === 'dgnl_hsa' || progMeta.key === 'dgtd_tsa'
      ? 1
      : progMeta.key === 'hsg'
        ? 1.0
        : isMathSubject(exam.subject)
          ? 0.5
          : 0.25;

  const pointPerQuestion =
    exam.settings?.point_per_question && exam.settings.point_per_question > 0
      ? exam.settings.point_per_question
      : defaultPpq;

  const pointPerSa =
    exam.settings?.point_per_sa && exam.settings.point_per_sa > 0
      ? exam.settings.point_per_sa
      : defaultPpSa;

  const maxScore =
    exam.settings?.max_score && exam.settings.max_score > 0
      ? exam.settings.max_score
      : progMeta.defaultMaxScore;

  return {
    isVsat: false,
    pointPerQuestion,
    pointPerSa,
    maxScore,
  };
}

/**
 * Normalizes Vietnamese short-answer (`sa`) input:
 * - Converts Vietnamese comma decimals (`-2,5` -> `-2.5`) across all commas
 * - Collapses spaces around minus sign (`- 2,5` -> `-2.5`)
 */
export function normalizeShortAnswer(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/^-\s+/, '-')
    .replace(/\s+/g, ' ');
}

export function isShortAnswerMatch(submitted: string | null | undefined, expected: string | null | undefined): boolean {
  const normSub = normalizeShortAnswer(submitted);
  const normExp = normalizeShortAnswer(expected);
  if (!normSub || !normExp) return false;

  // Support multiple accepted variants separated by `|` or `;` (e.g. "12.5 | 25/2")
  const variants = normExp.split(/[|;]/).map(s => s.trim()).filter(Boolean);
  for (const v of variants) {
    if (normSub === v) return true;
    const nSub = Number(normSub);
    const nExp = Number(v);
    if (!Number.isNaN(nSub) && !Number.isNaN(nExp) && nSub === nExp) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a short-answer (`sa`) string conforms to Bộ GD&ĐT's 4-character bubble sheet rule
 * (digits, `-`, and `,` or `.`, max 4 characters).
 */
export function validateSaAnswerFormat(raw: string | null | undefined): {
  validSheetLength: boolean;
  length: number;
  warning?: string;
} {
  const val = String(raw ?? '').trim();
  if (!val) {
    return { validSheetLength: false, length: 0, warning: 'Chưa có đáp án cho câu trả lời ngắn (sa).' };
  }
  // Ignore dynamic formula placeholders like {tinh: ...}
  if (val.includes('{tinh:') || val.includes('!')) {
    return { validSheetLength: true, length: val.length };
  }
  const primary = val.split(/[|;]/)[0].trim();
  if (primary.length > 4) {
    return {
      validSheetLength: false,
      length: primary.length,
      warning: `Đáp án "${primary}" dài ${primary.length} ký tự (phiếu tô THPT chuẩn Bộ GD&ĐT tối đa 4 ký tự tính cả dấu "-" và ",").`,
    };
  }
  return { validSheetLength: true, length: primary.length };
}

export function formatVietnamDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function checkExamSessionWindow(
  settings?: ExamSettings | null,
  nowMs: number = Date.now()
): {
  state: 'open' | 'not_open' | 'closed';
  openAtFormatted?: string;
  closeAtFormatted?: string;
} {
  if (!settings) return { state: 'open' };
  const openMs = settings.open_at ? new Date(settings.open_at).getTime() : NaN;
  const closeMs = settings.close_at ? new Date(settings.close_at).getTime() : NaN;
  const openAtFormatted = formatVietnamDateTime(settings.open_at);
  const closeAtFormatted = formatVietnamDateTime(settings.close_at);

  if (!Number.isNaN(openMs) && nowMs < openMs) {
    return { state: 'not_open', openAtFormatted, closeAtFormatted };
  }
  if (!Number.isNaN(closeMs) && nowMs > closeMs) {
    return { state: 'closed', openAtFormatted, closeAtFormatted };
  }
  return { state: 'open', openAtFormatted, closeAtFormatted };
}

export function canStudentViewDetailedAnswers(
  settings?: ExamSettings | null,
  isTeacherOrAdmin = false,
  nowMs: number = Date.now()
): { allowed: boolean; reason?: string } {
  if (isTeacherOrAdmin) return { allowed: true };
  const mode: ShowAnswersMode = settings?.show_answers_mode || 'always';
  if (mode === 'always') return { allowed: true };
  if (mode === 'never') {
    return {
      allowed: false,
      reason: 'Giáo viên đã cấu hình chỉ công bố điểm tổng, không hiển thị đáp án và lời giải chi tiết cho đề thi này.',
    };
  }
  // mode === 'after_close'
  const closeMs = settings?.close_at ? new Date(settings.close_at).getTime() : NaN;
  if (!Number.isNaN(closeMs) && nowMs >= closeMs) {
    return { allowed: true };
  }
  const closeStr = formatVietnamDateTime(settings?.close_at);
  return {
    allowed: false,
    reason: closeStr
      ? `Đáp án và lời giải chi tiết sẽ được mở tự động sau khi kết thúc ca thi (${closeStr}).`
      : 'Đáp án và lời giải chi tiết hiện đang khóa cho đến khi giáo viên đóng ca thi.',
  };
}

/**
 * Pick exactly `k` items from a shuffled array.
 * If k >= array.length, return the full array.
 */
function pickK<T>(arr: T[], k: number): T[] {
  if (k <= 0 || arr.length === 0) return [];
  return arr.slice(0, Math.min(k, arr.length));
}

export function buildShuffledExam(
  allQuestions: ExamQuestion[],
  prng: () => number,
  settings?: ExamSettings | null,
): ExamQuestion[] {
  const resolvedQuestions = allQuestions.map(q => instantiateDynamicQuestion(q, prng));

  if (resolvedQuestions.some(q => q.type === 'matching')) {
    const order: Record<string, number> = { msq: 0, mcq: 1, single_choice: 1, read: 1, matching: 2, sa: 3, cloze_text: 3 };
    return resolvedQuestions
      .map((q, index) => ({ q, index }))
      .sort((a, b) => (order[a.q.type] ?? 9) - (order[b.q.type] ?? 9) || a.index - b.index)
      .map(x => x.q);
  }
  const bySection = {
    mcq: resolvedQuestions.filter(q => !q.type || q.type === 'mcq' || q.type === 'single_choice'),
    multiple_choice: resolvedQuestions.filter(q => q.type === 'multiple_choice'),
    msq: resolvedQuestions.filter(q => q.type === 'msq'),
    sa: resolvedQuestions.filter(q => q.type === 'sa'),
    true_false: resolvedQuestions.filter(q => q.type === 'true_false'),
    tl: resolvedQuestions.filter(q => q.type === 'tl'),
    read: resolvedQuestions.filter(q => q.type === 'read'),
    read_cloze: resolvedQuestions.filter(q => q.type === 'read_cloze'),
    ordering: resolvedQuestions.filter(q => q.type === 'ordering'),
    list: resolvedQuestions.filter(q => q.type === 'list'),
    matching: resolvedQuestions.filter(q => q.type === 'matching'),
    cloze_text: resolvedQuestions.filter(q => q.type === 'cloze_text'),
  };

  const ppt = settings?.pick_per_type;
  const applyPick = <T extends ExamQuestion>(pool: T[], typeKey: string): T[] => {
    if (!ppt) return pool;
    const k = ppt[typeKey] ?? (typeKey === 'mcq' ? ppt['single_choice'] : undefined) ?? (typeKey === 'single_choice' ? ppt['mcq'] : undefined);
    if (k === undefined) return pool;
    return pickK(pool, k) as T[];
  };

  const shuffled = {
    mcq: applyPick(shuffleArrayWithPRNG(bySection.mcq, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'mcq'),
    multiple_choice: applyPick(shuffleArrayWithPRNG(bySection.multiple_choice, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'multiple_choice'),
    msq: applyPick(shuffleArrayWithPRNG(bySection.msq, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'msq'),
    sa: applyPick(shuffleArrayWithPRNG(bySection.sa, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'sa'),
    true_false: applyPick(shuffleArrayWithPRNG(bySection.true_false, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'true_false'),
    tl: applyPick(shuffleArrayWithPRNG(bySection.tl, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'tl'),
    ordering: applyPick(shuffleArrayWithPRNG(bySection.ordering, prng).map(q => ({ ...q, answers: shuffleArrayWithPRNG(q.answers || [], prng) })), 'ordering'),
    list: applyPick(shuffleArrayWithPRNG(bySection.list, prng), 'list'),
    matching: applyPick(bySection.matching, 'matching'),
    cloze_text: applyPick(bySection.cloze_text, 'cloze_text'),
  };

  const readPoolAll = [
    ...bySection.read.map(q => shuffleReadQuestion(q, prng, true)),
    ...bySection.read_cloze.map(q => shuffleReadQuestion(q, prng, false)),
  ];
  const shuffledReadPoolAll = shuffleArrayWithPRNG(readPoolAll, prng);

  const pickedRead = ppt?.['read'] !== undefined
    ? pickK(shuffledReadPoolAll.filter(q => q.type === 'read'), ppt['read'])
    : shuffledReadPoolAll.filter(q => q.type === 'read');
  const pickedReadCloze = ppt?.['read_cloze'] !== undefined
    ? pickK(shuffledReadPoolAll.filter(q => q.type === 'read_cloze'), ppt['read_cloze'])
    : shuffledReadPoolAll.filter(q => q.type === 'read_cloze');

  const pickedReadSet = new Set([...pickedRead, ...pickedReadCloze]);
  const shuffledReadPool = shuffledReadPoolAll.filter(q => pickedReadSet.has(q));

  return [
    ...shuffled.mcq,
    ...shuffledReadPool,
    ...shuffled.msq,
    ...shuffled.sa,
    ...shuffled.tl,
    ...shuffled.multiple_choice,
    ...shuffled.list,
    ...shuffled.matching,
    ...shuffled.cloze_text,
    ...shuffled.ordering,
    ...shuffled.true_false,
  ];
}

function shuffleReadQuestion(q: ExamQuestion, prng: () => number, shuffleSubquestions = true): ExamQuestion {
  const cloned: ExamQuestion = JSON.parse(JSON.stringify(q));
  let subs = cloned.metadata?.questions;

  if (!subs && (cloned as any).questions) {
    subs = (cloned as any).questions;
  }

  if (!subs || !Array.isArray(subs)) return cloned;

  subs.forEach((sq: any) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const validOptions: { letter: string; text: string }[] = [];

    for (const l of letters) {
      const text = sq[`option_${l.toLowerCase()}`];
      if (text !== undefined && text !== '') {
        validOptions.push({ letter: l, text });
      }
    }

    if (validOptions.length === 0) return;

    const originalCorrectLetter = sq.correct_option;
    const shuffledOptions = shuffleArrayWithPRNG(validOptions, prng);

    shuffledOptions.forEach((opt, idx) => {
      const newLetter = letters[idx];
      sq[`option_${newLetter.toLowerCase()}`] = opt.text;

      if (opt.letter === originalCorrectLetter) {
        sq.correct_option = newLetter;
      }
    });

    for (let i = shuffledOptions.length; i < letters.length; i++) {
      delete sq[`option_${letters[i].toLowerCase()}`];
    }
  });

  cloned.metadata = cloned.metadata || {};
  if (shuffleSubquestions) {
    cloned.metadata.questions = shuffleArrayWithPRNG(subs, prng);
  } else {
    cloned.metadata.questions = subs;
  }

  return cloned;
}

export function calculateEffectiveQuestionCount(
  questions: Array<{ type?: string; metadata?: any }>,
  settings?: { pick_per_type?: Record<string, number> } | null
): number {
  if (!questions || questions.length === 0) return 0;

  const countSingleOrGroup = (q: { type?: string; metadata?: any }): number => {
    const rawType = q.metadata?.type || q.type;
    if (rawType === 'read' || rawType === 'read_cloze' || rawType === 'list' || rawType === 'matching' || rawType === 'cloze_text') {
      const subs = q.metadata?.questions || (q as any).questions || [];
      return subs.length > 0 ? subs.length : 1;
    }
    return 1;
  };

  const ppt = settings?.pick_per_type;
  if (!ppt || Object.keys(ppt).length === 0) {
    return questions.reduce((sum, q) => sum + countSingleOrGroup(q), 0);
  }

  const byType: Record<string, Array<{ type?: string; metadata?: any }>> = {};
  for (const q of questions) {
    const rawType = q.metadata?.type || q.type || 'mcq';
    const t = rawType === 'single_choice' ? 'mcq' : rawType;
    if (!byType[t]) byType[t] = [];
    byType[t].push(q);
  }

  let total = 0;
  for (const [type, pool] of Object.entries(byType)) {
    let k = ppt[type];
    if (k === undefined && type === 'mcq') k = ppt['single_choice'];
    if (k === undefined && type === 'single_choice') k = ppt['mcq'];

    const countToTake = (k !== undefined && typeof k === 'number')
      ? Math.min(Math.max(0, k), pool.length)
      : pool.length;

    const takenItems = pool.slice(0, countToTake);
    for (const q of takenItems) {
      total += countSingleOrGroup(q);
    }
  }

  return total;
}
