import type { ExamProgram } from '../types';
import { validateSaAnswerFormat } from './exam';

export type ExamTypeKey = ExamProgram;

export type SubjectKind =
  | 'toan'
  | 'vat-ly'
  | 'hoa-hoc'
  | 'sinh-hoc'
  | 'tieng-anh'
  | 'ngu-van'
  | 'lich-su'
  | 'dia-ly'
  | 'ktpl'
  | 'tin-hoc'
  | 'cong-nghe'
  | 'general';

export type MatrixRowKey =
  | 'mcq'
  | 'msq'
  | 'sa'
  | 'tl'
  | 'read_cloze'
  | 'ordering'
  | 'read'
  | 'matching';

export const MATRIX_ROW_KEYS: MatrixRowKey[] = [
  'mcq',
  'msq',
  'sa',
  'tl',
  'read_cloze',
  'ordering',
  'read',
  'matching',
];

export interface MatrixCellLevels {
  nb: number;
  th: number;
  vd: number;
  vdc: number;
}

export type ExamMatrix2D = Record<MatrixRowKey, MatrixCellLevels>;

export interface MatrixQuestionCounts {
  mcq: number;
  msq: number;
  sa: number;
  tl: number;
  read_cloze: number;
  ordering: number;
  read: number;
  matching: number;
}

export interface CognitivePercentages {
  nb: number;
  th: number;
  vd: number;
  vdc: number;
}

export interface RecommendedExamPreset {
  duration: number;
  pointPerQuestion: number;
  pointPerSa: number;
  maxScore: number;
  threeLevelMode: boolean; // true = Công văn 7991 (Biết - Hiểu - Vận dụng), false = 4 mức (NB - TH - VD - VDC)
  counts: MatrixQuestionCounts;
  levels: CognitivePercentages;
  matrix2d: ExamMatrix2D;
  note: string;
}

export interface BuildPromptOptions {
  subjectName: string;
  crossSubjects?: string[]; // Cho kỳ thi liên môn ĐGNL HSA / V-ACT / TSA
  examType: ExamTypeKey;
  duration: number;
  textbook: string;
  topics: string;
  threeLevelMode?: boolean;
  matrix2d: ExamMatrix2D;
  pointPerQuestion?: number;
  pointPerSa?: number;
  maxScore?: number;
  includeDynamicMath?: boolean;
  extraNotes?: string;
}

function normalizeVi(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function detectSubjectKind(subjectNameOrSlug: string): SubjectKind {
  const s = normalizeVi(subjectNameOrSlug);
  if (s.includes('toan')) return 'toan';
  if (s.includes('vat ly') || s.includes('vat li') || s === 'ly' || s.startsWith('ly ')) return 'vat-ly';
  if (s.includes('hoa')) return 'hoa-hoc';
  if (s.includes('sinh')) return 'sinh-hoc';
  if (s.includes('tieng anh') || s.includes('ngoai ngu') || s === 'anh') return 'tieng-anh';
  if (s.includes('ngu van') || s === 'van') return 'ngu-van';
  if (s.includes('lich su') || s === 'su') return 'lich-su';
  if (s.includes('dia ly') || s.includes('dia li') || s === 'dia') return 'dia-ly';
  if (s.includes('kinh te') || s.includes('phap luat') || s.includes('ktpl') || s.includes('gdcd')) return 'ktpl';
  if (s.includes('tin hoc') || s === 'tin') return 'tin-hoc';
  if (s.includes('cong nghe')) return 'cong-nghe';
  return 'general';
}

export const EXAM_TYPE_LABELS: Record<ExamTypeKey, string> = {
  '15m': 'Đánh giá thường xuyên 15 phút (ĐĐGtx)',
  midterm: 'Kiểm tra Giữa học kỳ (theo Công văn 7991/BGDĐT-GDTrH)',
  '45m': 'Kiểm tra Giữa học kỳ (theo Công văn 7991/BGDĐT-GDTrH)',
  semester: 'Kiểm tra Cuối học kỳ (theo Công văn 7991/BGDĐT-GDTrH)',
  mock_thpt: 'Thi thử Tốt nghiệp THPT (Chuẩn cấu trúc Bộ GD&ĐT 2025)',
  dgnl_hsa: 'Đánh giá năng lực ĐHQG Hà Nội (HSA - Liên môn)',
  dgnl_vact: 'Đánh giá năng lực ĐHQG TP.HCM (V-ACT - Liên môn)',
  dgtd_tsa: 'Đánh giá tư duy ĐH Bách Khoa Hà Nội (TSA)',
  vsat: 'Đánh giá năng lực đại học V-SAT',
  hsg: 'Kỳ thi chọn Học sinh giỏi cấp THPT (Thang điểm 20)',
};

export const TEXTBOOK_LABELS: Record<string, string> = {
  all: 'Chung 3 bộ sách (Chương trình GDPT 2018)',
  kntt: 'Kết nối tri thức với cuộc sống',
  ctst: 'Chân trời sáng tạo',
  cd: 'Cánh diều',
};

export const MATRIX_ROW_META: Record<
  MatrixRowKey,
  { label: string; sub: string; unitLabel: string; subMultiplier: number }
> = {
  mcq: { label: 'Phần I · Trắc nghiệm 4 lựa chọn', sub: 'mcq', unitLabel: 'câu', subMultiplier: 1 },
  msq: { label: 'Phần II · Đúng/Sai 4 ý (a,b,c,d)', sub: 'msq', unitLabel: 'câu chùm', subMultiplier: 1 },
  sa: { label: 'Phần III · Trả lời ngắn (≤ 4 ký tự)', sub: 'sa', unitLabel: 'câu', subMultiplier: 1 },
  tl: { label: 'Phần Tự luận (CV 7991 / HSG / Văn)', sub: 'tl', unitLabel: 'câu', subMultiplier: 1 },
  read_cloze: { label: 'Đọc điền khuyết thông báo/tờ rơi', sub: 'read_cloze', unitLabel: 'bài đọc', subMultiplier: 5 },
  ordering: { label: 'Sắp xếp hội thoại / thư / đoạn văn', sub: 'ordering', unitLabel: 'câu', subMultiplier: 1 },
  read: { label: 'Đọc hiểu ngữ liệu / văn bản', sub: 'read', unitLabel: 'bài đọc', subMultiplier: 5 },
  matching: { label: 'Ghép cặp chùm (V-SAT)', sub: 'matching', unitLabel: 'nhóm', subMultiplier: 4 },
};

export function createEmptyMatrix2D(): ExamMatrix2D {
  return {
    mcq: { nb: 0, th: 0, vd: 0, vdc: 0 },
    msq: { nb: 0, th: 0, vd: 0, vdc: 0 },
    sa: { nb: 0, th: 0, vd: 0, vdc: 0 },
    tl: { nb: 0, th: 0, vd: 0, vdc: 0 },
    read_cloze: { nb: 0, th: 0, vd: 0, vdc: 0 },
    ordering: { nb: 0, th: 0, vd: 0, vdc: 0 },
    read: { nb: 0, th: 0, vd: 0, vdc: 0 },
    matching: { nb: 0, th: 0, vd: 0, vdc: 0 },
  };
}

function splitTotalByWeights(total: number, weights: [number, number, number, number]): MatrixCellLevels {
  if (total <= 0) return { nb: 0, th: 0, vd: 0, vdc: 0 };
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => (total * w) / sumW);
  const floors = raw.map(v => Math.floor(v));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, idx) => ({ idx, frac: v - floors[idx] }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) {
    floors[order[i % 4].idx]++;
  }
  return { nb: floors[0], th: floors[1], vd: floors[2], vdc: floors[3] };
}

/**
 * Distributes row counts intelligently across cognitive levels:
 * - MCQ leans toward Biết & Hiểu
 * - MSQ (4 statements) leans toward Hiểu & Vận dụng
 * - SA / TL leans toward Vận dụng & Vận dụng cao
 * When `threeLevelMode` (CV 7991) is active, `vdc` is merged into `vd` (Biết - Hiểu - Vận dụng).
 */
export function distributeCountsTo2DMatrix(
  counts: MatrixQuestionCounts,
  levels: CognitivePercentages,
  threeLevelMode = false
): ExamMatrix2D {
  const m = createEmptyMatrix2D();
  const effVdc = threeLevelMode ? 0 : levels.vdc;
  const effVd = threeLevelMode ? levels.vd + levels.vdc : levels.vd;

  // Row-specific natural difficulty skews modulated by overall percentages
  m.mcq = splitTotalByWeights(counts.mcq, [
    levels.nb * 1.4,
    levels.th * 1.1,
    effVd * 0.6,
    effVdc * 0.2,
  ]);
  m.msq = splitTotalByWeights(counts.msq, [
    levels.nb * 0.6,
    levels.th * 1.3,
    effVd * 1.2,
    effVdc * 0.8,
  ]);
  m.sa = splitTotalByWeights(counts.sa, [
    levels.nb * 0.2,
    levels.th * 0.7,
    effVd * 1.5,
    effVdc * 1.8,
  ]);
  m.tl = splitTotalByWeights(counts.tl, [
    levels.nb * 0.1,
    levels.th * 0.6,
    effVd * 1.5,
    effVdc * 1.8,
  ]);
  m.read_cloze = splitTotalByWeights(counts.read_cloze, [levels.nb, levels.th, effVd, effVdc]);
  m.ordering = splitTotalByWeights(counts.ordering, [levels.nb * 0.8, levels.th * 1.3, effVd, effVdc * 0.3]);
  m.read = splitTotalByWeights(counts.read, [levels.nb * 0.5, levels.th * 1.2, effVd * 1.3, effVdc]);
  m.matching = splitTotalByWeights(counts.matching, [levels.nb * 0.6, levels.th * 1.2, effVd * 1.2, effVdc * 0.6]);

  return m;
}

export function summarize2DMatrix(
  matrix2d: ExamMatrix2D,
  opts?: { pointPerQuestion?: number; pointPerSa?: number; isVsat?: boolean }
): {
  rowTotals: MatrixQuestionCounts;
  colTotals: MatrixCellLevels;
  totalBlocks: number;
  totalEffectiveItems: number;
  estimatedObjectiveScore: number;
} {
  const rowTotals: MatrixQuestionCounts = {
    mcq: 0,
    msq: 0,
    sa: 0,
    tl: 0,
    read_cloze: 0,
    ordering: 0,
    read: 0,
    matching: 0,
  };
  const colTotals: MatrixCellLevels = { nb: 0, th: 0, vd: 0, vdc: 0 };

  let totalBlocks = 0;
  let totalEffectiveItems = 0;

  for (const key of MATRIX_ROW_KEYS) {
    const cell = matrix2d[key] || { nb: 0, th: 0, vd: 0, vdc: 0 };
    const rSum = (cell.nb || 0) + (cell.th || 0) + (cell.vd || 0) + (cell.vdc || 0);
    rowTotals[key] = rSum;
    colTotals.nb += cell.nb || 0;
    colTotals.th += cell.th || 0;
    colTotals.vd += cell.vd || 0;
    colTotals.vdc += cell.vdc || 0;
    totalBlocks += rSum;
    totalEffectiveItems += rSum * MATRIX_ROW_META[key].subMultiplier;
  }

  const isVsat = Boolean(opts?.isVsat);
  const ppq = isVsat ? 6 : (opts?.pointPerQuestion || 0.25);
  const ppSa = isVsat ? 6 : (opts?.pointPerSa || 0.5);
  const msqMax = isVsat ? 6 : 1.0;
  const matchMax = isVsat ? 6 : ppq;

  const estimatedObjectiveScore =
    Math.round(
      (rowTotals.mcq * ppq +
        rowTotals.ordering * ppq +
        rowTotals.read_cloze * 5 * ppq +
        rowTotals.read * 5 * ppq +
        rowTotals.msq * msqMax +
        rowTotals.sa * ppSa +
        rowTotals.matching * matchMax) *
        100
    ) / 100;

  return {
    rowTotals,
    colTotals,
    totalBlocks,
    totalEffectiveItems,
    estimatedObjectiveScore,
  };
}

export function getRecommendedPreset(subjectName: string, examType: ExamTypeKey): RecommendedExamPreset {
  const kind = detectSubjectKind(subjectName);
  const z: MatrixQuestionCounts = {
    mcq: 0,
    msq: 0,
    sa: 0,
    tl: 0,
    read_cloze: 0,
    ordering: 0,
    read: 0,
    matching: 0,
  };

  // 1. Kiểm tra thường xuyên 15 phút (ĐĐGtx - 3 mức CV 7991)
  if (examType === '15m') {
    const levels: CognitivePercentages = { nb: 50, th: 30, vd: 20, vdc: 0 };
    const counts: MatrixQuestionCounts =
      kind === 'tieng-anh'
        ? { ...z, mcq: 5, ordering: 2, read_cloze: 1 }
        : kind === 'ngu-van'
          ? { ...z, read: 1, tl: 1 }
          : kind === 'toan'
            ? { ...z, mcq: 8, msq: 2, sa: 4 }
            : { ...z, mcq: 12, msq: 2, sa: kind === 'lich-su' ? 0 : 4 };
    const ppq = kind === 'toan' ? 0.5 : 0.25;
    const ppSa = kind === 'toan' ? 1.0 : 0.5;
    return {
      duration: 15,
      pointPerQuestion: ppq,
      pointPerSa: ppSa,
      maxScore: 10,
      threeLevelMode: true,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, true),
      note: 'Đánh giá thường xuyên 15 phút (3 mức năng lực Biết 50% - Hiểu 30% - Vận dụng 20%).',
    };
  }

  // 2. Kiểm tra Giữa kỳ / Cuối kỳ theo Công văn 7991/BGDĐT-GDTrH (3 mức: Biết 40% - Hiểu 30% - Vận dụng 30%)
  if (examType === 'midterm' || examType === '45m' || examType === 'semester') {
    const levels: CognitivePercentages = { nb: 40, th: 30, vd: 30, vdc: 0 };
    const isSemester = examType === 'semester';
    let counts: MatrixQuestionCounts;
    let duration = isSemester ? 60 : 45;
    let ppq = 0.25;
    let ppSa = 0.25;
    let note = '';

    if (kind === 'toan') {
      duration = isSemester ? 90 : 60;
      ppSa = 0.5;
      counts = { ...z, mcq: 12, msq: 2, sa: 4, tl: 3 };
      note = 'Chuẩn Công văn 7991 môn Toán (3 mức: 40% Biết - 30% Hiểu - 30% Vận dụng): 7.0đ Trắc nghiệm (12 MCQ + 2 Đúng/Sai + 4 TL ngắn) + 3.0đ Tự luận.';
    } else if (kind === 'tieng-anh') {
      duration = isSemester ? 60 : 45;
      counts = { ...z, mcq: 10, ordering: 5, read_cloze: 1, read: 2 };
      note = 'Chuẩn Công văn 7991 Tiếng Anh 12 (3 mức năng lực): kết hợp Từ vựng/Ngữ pháp, Sắp xếp đoạn, Đọc điền và Đọc hiểu.';
    } else if (kind === 'ngu-van') {
      duration = isSemester ? 90 : 60;
      ppq = 0.5;
      counts = { ...z, read: 1, tl: 2 };
      note = 'Chuẩn Công văn 7991 Ngữ văn 12: Ngữ liệu Đọc hiểu mới ngoài SGK (4.0đ) + Viết nghị luận (6.0đ).';
    } else if (kind === 'lich-su') {
      counts = { ...z, mcq: 16, msq: 3, tl: 2 };
      note = 'Chuẩn Công văn 7991 Lịch sử 12 (7.0đ Trắc nghiệm + 3.0đ Tự luận): 16 MCQ (4đ) + 3 Đúng/Sai tư liệu (3đ) + 2 Tự luận (3đ).';
    } else {
      counts = { ...z, mcq: 12, msq: 3, sa: 4, tl: 2 };
      note = 'Chuẩn Công văn 7991 Bộ GD&ĐT (3 mức Biết 40% - Hiểu 30% - Vận dụng 30%): 7.0đ Trắc nghiệm (12 MCQ + 3 Đúng/Sai + 4 TL ngắn × 0.25đ) + 3.0đ Tự luận.';
    }

    return {
      duration,
      pointPerQuestion: ppq,
      pointPerSa: ppSa,
      maxScore: 10,
      threeLevelMode: true,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, true),
      note,
    };
  }

  // 3. Đánh giá năng lực ĐHQG Hà Nội (HSA)
  if (examType === 'dgnl_hsa') {
    const levels: CognitivePercentages = { nb: 20, th: 35, vd: 30, vdc: 15 };
    const counts: MatrixQuestionCounts = { ...z, mcq: 15, sa: 5, read: 2 };
    return {
      duration: 75,
      pointPerQuestion: 1,
      pointPerSa: 1,
      maxScore: 30,
      threeLevelMode: false,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, false),
      note: 'Cấu trúc ĐGNL ĐHQG Hà Nội (HSA): kết hợp câu hỏi Trắc nghiệm 4 lựa chọn, Điền đáp án (SA) và Chùm câu hỏi đọc hiểu ngữ liệu/khoa học liên môn.',
    };
  }

  // 4. Đánh giá năng lực ĐHQG TP.HCM (V-ACT)
  if (examType === 'dgnl_vact') {
    const levels: CognitivePercentages = { nb: 20, th: 35, vd: 30, vdc: 15 };
    const counts: MatrixQuestionCounts = { ...z, mcq: 15, read: 3 };
    return {
      duration: 60,
      pointPerQuestion: 4,
      pointPerSa: 4,
      maxScore: 120,
      threeLevelMode: false,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, false),
      note: 'Cấu trúc ĐGNL ĐHQG TP.HCM (V-ACT 2025): Ngôn ngữ (Việt - Anh), Toán học & Tư duy khoa học (phân tích số liệu + suy luận khoa học theo bài đọc chùm).',
    };
  }

  // 5. Đánh giá tư duy ĐH Bách Khoa (TSA)
  if (examType === 'dgtd_tsa') {
    const levels: CognitivePercentages = { nb: 15, th: 35, vd: 30, vdc: 20 };
    const counts: MatrixQuestionCounts = { ...z, mcq: 12, msq: 4, sa: 4, read: 1 };
    return {
      duration: 60,
      pointPerQuestion: 1,
      pointPerSa: 1,
      maxScore: 25,
      threeLevelMode: false,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, false),
      note: 'Cấu trúc ĐGTD Bách Khoa (TSA): Tư duy Toán học, Đọc hiểu khoa học và Giải quyết vấn đề (MCQ, Đúng/Sai nhiều mệnh đề, Trả lời ngắn).',
    };
  }

  // 6. V-SAT
  if (examType === 'vsat') {
    const levels: CognitivePercentages = { nb: 20, th: 35, vd: 30, vdc: 15 };
    const counts: MatrixQuestionCounts =
      kind === 'toan'
        ? { ...z, msq: 9, mcq: 6, matching: 2, sa: 8 }
        : kind === 'tieng-anh'
          ? { ...z, msq: 6, mcq: 6, matching: 1, read: 2 }
          : { ...z, msq: 9, mcq: 6, matching: 2, sa: 5 };
    return {
      duration: kind === 'toan' ? 90 : 60,
      pointPerQuestion: 6,
      pointPerSa: 6,
      maxScore: 150,
      threeLevelMode: false,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, false),
      note: 'Cấu trúc chuẩn V-SAT trên máy tính (thang 150 điểm): Phần 1 Đúng/Sai + Phần 2 MCQ + Phần 3 Ghép cặp (matching) + Phần 4 Trả lời ngắn.',
    };
  }

  // 7. Đề thi Học sinh giỏi (HSG - Thang 20 điểm)
  if (examType === 'hsg') {
    const levels: CognitivePercentages = { nb: 10, th: 25, vd: 40, vdc: 25 };
    const counts: MatrixQuestionCounts =
      kind === 'ngu-van'
        ? { ...z, tl: 2 }
        : { ...z, mcq: 12, msq: 4, sa: 4, tl: 3 };
    return {
      duration: 150,
      pointPerQuestion: 0.5,
      pointPerSa: 1.0,
      maxScore: 20,
      threeLevelMode: false,
      counts,
      levels,
      matrix2d: distributeCountsTo2DMatrix(counts, levels, false),
      note: 'Đề thi chọn Học sinh giỏi cấp THPT (150 phút - Thang điểm 20): phân hóa mạnh ở mức Vận dụng & Vận dụng cao, kết hợp Trắc nghiệm và Tự luận.',
    };
  }

  // 8. Mặc định: Thi thử Tốt nghiệp THPT chuẩn Bộ GD&ĐT từ 2025
  const thptLevels: CognitivePercentages = { nb: 35, th: 30, vd: 20, vdc: 15 };
  if (kind === 'toan') {
    const counts = { ...z, mcq: 12, msq: 4, sa: 6 };
    return {
      duration: 90,
      pointPerQuestion: 0.25,
      pointPerSa: 0.5,
      maxScore: 10,
      threeLevelMode: false,
      counts,
      levels: thptLevels,
      matrix2d: distributeCountsTo2DMatrix(counts, thptLevels, false),
      note: 'Chuẩn Tốt nghiệp THPT 2025 môn Toán (90 phút - 22 câu = 10.0đ): Phần I 12 MCQ (3.0đ) + Phần II 4 Đúng/Sai (4.0đ) + Phần III 6 Trả lời ngắn × 0.5đ (3.0đ).',
    };
  }
  if (kind === 'lich-su') {
    const counts = { ...z, mcq: 24, msq: 4, sa: 0 };
    return {
      duration: 50,
      pointPerQuestion: 0.25,
      pointPerSa: 0.25,
      maxScore: 10,
      threeLevelMode: false,
      counts,
      levels: thptLevels,
      matrix2d: distributeCountsTo2DMatrix(counts, thptLevels, false),
      note: 'Chuẩn Tốt nghiệp THPT 2025 môn Lịch sử (50 phút - 28 câu = 10.0đ): Phần I 24 MCQ (6.0đ) + Phần II 4 Đúng/Sai tư liệu (4.0đ). Không có Phần III.',
    };
  }
  if (kind === 'tieng-anh') {
    const counts = { ...z, ordering: 5, read_cloze: 2, read: 2 };
    return {
      duration: 50,
      pointPerQuestion: 0.25,
      pointPerSa: 0.25,
      maxScore: 10,
      threeLevelMode: false,
      counts,
      levels: thptLevels,
      matrix2d: distributeCountsTo2DMatrix(counts, thptLevels, false),
      note: 'Chuẩn Tốt nghiệp THPT 2025 môn Tiếng Anh (50 phút - 40 câu = 10.0đ): 2 bài Đọc điền (12 câu) + 5 câu Sắp xếp hội thoại/thư/đoạn + 2 bài Đọc hiểu.',
    };
  }
  if (kind === 'ngu-van') {
    const counts = { ...z, read: 1, tl: 2 };
    return {
      duration: 120,
      pointPerQuestion: 0.5,
      pointPerSa: 0.5,
      maxScore: 10,
      threeLevelMode: false,
      counts,
      levels: thptLevels,
      matrix2d: distributeCountsTo2DMatrix(counts, thptLevels, false),
      note: 'Chuẩn Tốt nghiệp THPT 2025 môn Ngữ văn (120 phút - 10.0đ): Đọc hiểu ngữ liệu ngoài SGK (4.0đ) + Đoạn văn NLXH 200 chữ (2.0đ) + Bài văn NLVH 600 chữ (4.0đ).',
    };
  }

  // Lý, Hóa, Sinh, Địa, KT&PL, Tin học, Công nghệ
  const counts = { ...z, mcq: 18, msq: 4, sa: 6 };
  return {
    duration: 50,
    pointPerQuestion: 0.25,
    pointPerSa: 0.25,
    maxScore: 10,
    threeLevelMode: false,
    counts,
    levels: thptLevels,
    matrix2d: distributeCountsTo2DMatrix(counts, thptLevels, false),
    note: 'Chuẩn Tốt nghiệp THPT 2025 (50 phút - 28 câu = 10.0đ): Phần I 18 MCQ (4.5đ) + Phần II 4 Đúng/Sai (4.0đ) + Phần III 6 Trả lời ngắn × 0.25đ (1.5đ).',
  };
}

function getSubjectCurriculumGuidance(kind: SubjectKind, examType: ExamTypeKey, crossSubjects?: string[]): string {
  if (examType === 'dgnl_hsa' || examType === 'dgnl_vact' || examType === 'dgtd_tsa') {
    const crossStr = crossSubjects && crossSubjects.length > 0
      ? `Các lĩnh vực liên môn cần tích hợp trong đề: **${crossSubjects.join(', ')}**.`
      : `Tích hợp tư duy liên môn (Định lượng Toán học, Đọc hiểu Ngôn ngữ/Khoa học, Phân tích bảng biểu số liệu thực tiễn).`;
    return `- ${crossStr}
- Câu hỏi tập trung đánh giá năng lực đọc hiểu thông tin mới, suy luận logic từ biểu đồ/bảng số liệu/thí nghiệm khoa học thay vì học thuộc lòng máy móc.
- Công thức toán, lý, hóa viết chuẩn LaTeX \`$...$\`. Đáp án câu Trả lời ngắn (\`sa\`) là con số ngắn gọn chính xác.`;
  }

  switch (kind) {
    case 'toan':
      return `- Nội dung bám sát Toán 12 Chương trình GDPT 2018: Ứng dụng đạo hàm khảo sát hàm số & bài toán tối ưu thực tế; Vectơ và tọa độ không gian Oxyz; Thống kê mẫu số liệu ghép nhóm; Nguyên hàm - Tích phân và ứng dụng; Xác suất có điều kiện & công thức Bayes.
- Mọi công thức toán học BẮT BUỘC đặt trong cặp dấu \`$...$\` (inline) hoặc \`$$...$$\` (block).
- QUY TẮC PHIẾU TÔ BỘ GD&ĐT CHO CÂU TRẢ LỜI NGẮN (\`sa\`): Đáp án PHẢI là số nguyên hoặc số thập phân có độ dài **TỐI ĐA 4 KÝ TỰ** (tính cả dấu \`-\` và dấu thập phân, ví dụ: \`"12,5"\`, \`"-3,2"\`, \`"2025"\`, \`"0,75"\`). Đề bài phải ghi rõ quy ước làm tròn (ví dụ: "làm tròn kết quả đến hàng phần mười").`;
    case 'vat-ly':
      return `- Nội dung bám sát Vật lí 12 GDPT 2018: Vật lí nhiệt; Khí lí tưởng; Từ trường & Cảm ứng điện từ; Vật lí hạt nhân & Phóng xạ.
- Dùng ký hiệu đại lượng và đơn vị chuẩn SI, công thức LaTeX \`$...$\`. Gắn với thí nghiệm thực hành và ứng dụng thực tiễn.
- QUY TẮC PHIẾU TÔ BỘ GD&ĐT CHO CÂU TRẢ LỜI NGẮN (\`sa\`): Đáp án số **TỐI ĐA 4 KÝ TỰ** (ví dụ \`"2,45"\`, \`"-1,5"\`, \`"310"\`), nêu rõ làm tròn đến hàng đơn vị / phần mười / phần trăm.`;
    case 'hoa-hoc':
      return `- Nội dung bám sát Hóa học 12 GDPT 2018: Ester - Lipid; Carbohydrate; Hợp chất chứa Nitrogen (Amine, Amino acid, Peptide, Protein); Polymer; Pin điện và Điện phân; Đại cương kim loại & nguyên tố nhóm IA, IIA, kim loại chuyển tiếp dãy thứ nhất.
- BẮT BUỘC dùng danh pháp quốc tế IUPAC theo chương trình 2018 (sodium, potassium, iron, copper, ester, carboxylic acid, glucose, ethanol, sulfuric acid...). Công thức hóa học trình bày bằng LaTeX (ví dụ \`$\\text{CH}_3\\text{COOC}_2\\text{H}_5$\`).
- Đáp án câu Trả lời ngắn (\`sa\`) **TỐI ĐA 4 KÝ TỰ** (hiệu suất %, khối lượng gam, số đồng phân, số phát biểu đúng...).`;
    case 'sinh-hoc':
      return `- Nội dung bám sát Sinh học 12 GDPT 2018: Di truyền phân tử, điều hòa biểu hiện gene, công nghệ DNA; Di truyền NST & Di truyền người; Di truyền quần thể; Tiến hóa; Sinh thái học và phục hồi sinh thái.
- Đáp án câu Trả lời ngắn (\`sa\`) **TỐI ĐA 4 KÝ TỰ** (tỉ lệ kiểu hình dưới dạng số thập phân như \`"0,25"\`, số loại kiểu gene...).`;
    case 'tieng-anh':
      return `- Bám sát định dạng Đề thi Tiếng Anh THPT từ 2025 (CEFR B1 - B2/C1):
  + \`read_cloze\`: Đoạn quảng cáo / tờ rơi / thông báo có đánh dấu chỗ trống \`(1) _____\`.. trong \`content\`, kèm các câu hỏi con trong \`metadata.questions\`.
  + \`ordering\`: Sắp xếp hội thoại / thư / đoạn văn (các câu a, b, c, d, e trong \`question\`; 4 đáp án A, B, C, D là thứ tự như \`"c - a - b - d - e"\`).
  + \`read\`: Bài đọc hiểu 250–350 từ trong \`content\`, kèm các câu hỏi đọc hiểu trong \`metadata.questions\`.
  + Giải thích (\`explanation\`) viết rõ ràng bằng tiếng Việt kèm trích dẫn dẫn chứng.`;
    case 'ngu-van':
      return `- Bám sát yêu cầu đổi mới môn Ngữ văn GDPT 2018: BẮT BUỘC dùng ngữ liệu đọc hiểu MỚI (ngoài SGK), có nguồn trích dẫn rõ ràng; hướng dẫn chấm và dàn ý chi tiết đặt trong \`explanation\`.`;
    case 'lich-su':
      return `- Bám sát Lịch sử 12 GDPT 2018: Thế giới trong và sau Chiến tranh lạnh; ASEAN; Cách mạng tháng Tám 1945, kháng chiến chống Pháp & Mỹ; Đổi mới từ 1986; Đối ngoại Việt Nam & Hồ Chí Minh.
- Phần II (\`msq\` Đúng/Sai 4 ý): Mỗi câu PHẢI trích dẫn một đoạn tư liệu lịch sử gốc hoặc bảng niên biểu làm ngữ liệu, sau đó nêu 4 nhận định a, b, c, d phân hóa từ Biết → Hiểu → Vận dụng.`;
    case 'dia-ly':
      return `- Bám sát Địa lí 12 GDPT 2018: Tự nhiên, Dân cư, Chuyển dịch cơ cấu kinh tế, Ngành kinh tế & Vùng kinh tế - xã hội Việt Nam.
- Tích hợp bảng số liệu thống kê thực tế để hỏi nhận xét ở \`msq\` và tính toán chỉ số ở câu \`sa\` (**đáp án tối đa 4 ký tự**, ghi rõ làm tròn).`;
    case 'ktpl':
      return `- Bám sát Giáo dục Kinh tế và Pháp luật 12 GDPT 2018. Các câu Thông hiểu, Vận dụng và \`msq\` phải xây dựng tình huống pháp luật / kinh tế có nhân vật cụ thể (anh A, doanh nghiệp X...).`;
    case 'tin-hoc':
      return `- Bám sát Tin học 12 GDPT 2018: Trí tuệ nhân tạo (AI), Mạng máy tính & Internet, HTML & CSS, Cơ sở dữ liệu.`;
    case 'cong-nghe':
      return `- Bám sát Công nghệ 12 GDPT 2018: Kỹ thuật Điện - Điện tử (mạch xoay chiều 3 pha, hệ thống điện gia đình, vi điều khiển) hoặc Lâm nghiệp - Thủy sản.`;
    default:
      return `- Bám sát chuẩn yêu cầu cần đạt của Chương trình Giáo dục phổ thông 2018 lớp 12 tại Việt Nam.`;
  }
}

export function buildExamPrompt(opts: BuildPromptOptions): string {
  const kind = detectSubjectKind(opts.subjectName);
  const examLabel = EXAM_TYPE_LABELS[opts.examType] || opts.examType;
  const textbookLabel = TEXTBOOK_LABELS[opts.textbook] || TEXTBOOK_LABELS.all;
  const subjectGuidance = getSubjectCurriculumGuidance(kind, opts.examType, opts.crossSubjects);
  const summary = summarize2DMatrix(opts.matrix2d, {
    pointPerQuestion: opts.pointPerQuestion,
    pointPerSa: opts.pointPerSa,
    isVsat: opts.examType === 'vsat',
  });

  const formatCellBreakdown = (cell: MatrixCellLevels): string => {
    const parts: string[] = [];
    if (cell.nb > 0) parts.push(`${cell.nb} Biết (NB)`);
    if (cell.th > 0) parts.push(`${cell.th} Hiểu (TH)`);
    if (opts.threeLevelMode) {
      const vdCombined = (cell.vd || 0) + (cell.vdc || 0);
      if (vdCombined > 0) parts.push(`${vdCombined} Vận dụng (VD)`);
    } else {
      if (cell.vd > 0) parts.push(`${cell.vd} Vận dụng (VD)`);
      if (cell.vdc > 0) parts.push(`${cell.vdc} Vận dụng cao (VDC)`);
    }
    return parts.length > 0 ? ` [Phân bổ ma trận: ${parts.join(', ')}]` : '';
  };

  const structureLines: string[] = [];
  const { rowTotals } = summary;

  if (rowTotals.mcq > 0) {
    structureLines.push(
      `- ${rowTotals.mcq} câu Trắc nghiệm 4 phương án chọn 1 đáp án ("type": "mcq")${formatCellBreakdown(opts.matrix2d.mcq)}.`
    );
  }
  if (rowTotals.ordering > 0) {
    structureLines.push(
      `- ${rowTotals.ordering} câu Sắp xếp thứ tự hội thoại/thư/đoạn văn ("type": "ordering", có option_a..option_d và correct_option là A/B/C/D)${formatCellBreakdown(opts.matrix2d.ordering)}.`
    );
  }
  if (rowTotals.read_cloze > 0) {
    const subCount = kind === 'tieng-anh' && opts.examType === 'mock_thpt' ? 6 : 5;
    structureLines.push(
      `- ${rowTotals.read_cloze} bài Đọc điền khuyết ("type": "read_cloze"), mỗi bài gồm đoạn văn đánh số chỗ trống (1)..(${subCount}) trong "content" và đúng ${subCount} câu hỏi con trong "metadata.questions"${formatCellBreakdown(opts.matrix2d.read_cloze)}.`
    );
  }
  if (rowTotals.read > 0) {
    const subCount = kind === 'tieng-anh' && opts.examType === 'mock_thpt' ? 8 : 5;
    structureLines.push(
      `- ${rowTotals.read} bài Đọc hiểu ngữ liệu ("type": "read"), mỗi bài gồm ngữ liệu trong "content" và khoảng ${subCount} câu hỏi con trong "metadata.questions"${formatCellBreakdown(opts.matrix2d.read)}.`
    );
  }
  if (rowTotals.msq > 0) {
    structureLines.push(
      `- ${rowTotals.msq} câu Trắc nghiệm Đúng/Sai 4 ý ("type": "msq"): phần dẫn/tư liệu trong "question", 4 mệnh đề ở "option_a".."option_d" (phân hóa từ Biết -> Vận dụng). "correct_option" ghi các chữ cái của mệnh đề ĐÚNG cách nhau dấu phẩy (ví dụ "A,C" hoặc "A,B,D"; nếu cả 4 ý Sai thì để "")${formatCellBreakdown(opts.matrix2d.msq)}.`
    );
  }
  if (rowTotals.matching > 0) {
    structureLines.push(
      `- ${rowTotals.matching} câu Ghép cặp V-SAT ("type": "matching"): "content" nêu yêu cầu chung, "metadata.questions" chứa 4 mệnh đề cần ghép [{"question": "...", "correct_option": "A"}], "metadata.options" chứa 5–6 phương án trả lời [{"key": "A", "content": "..."}] (có phương án nhiễu)${formatCellBreakdown(opts.matrix2d.matching)}.`
    );
  }
  if (rowTotals.sa > 0) {
    structureLines.push(
      `- ${rowTotals.sa} câu Trắc nghiệm Trả lời ngắn ("type": "sa"): không có option_a..d, "correct_option" là đáp số ngắn gọn **TỐI ĐA 4 KÝ TỰ** theo chuẩn phiếu tô Bộ GD&ĐT (ví dụ: "12,5", "-4", "0,75")${formatCellBreakdown(opts.matrix2d.sa)}.`
    );
  }
  if (rowTotals.tl > 0) {
    structureLines.push(
      `- ${rowTotals.tl} câu Tự luận ("type": "tl"): nêu rõ câu hỏi và thang điểm từng ý, đặt hướng dẫn chấm chi tiết trong "explanation"${formatCellBreakdown(opts.matrix2d.tl)}.`
    );
  }

  if (structureLines.length === 0) {
    structureLines.push(`- 10 câu Trắc nghiệm 4 phương án ("type": "mcq").`);
  }

  const competencyNote = opts.threeLevelMode
    ? `Theo Công văn 7991/BGDĐT-GDTrH (3 mức năng lực): Biết (${summary.colTotals.nb} mục) · Hiểu (${summary.colTotals.th} mục) · Vận dụng (${summary.colTotals.vd + summary.colTotals.vdc} mục).`
    : `Theo 4 mức độ phân hóa: Nhận biết (${summary.colTotals.nb} mục) · Thông hiểu (${summary.colTotals.th} mục) · Vận dụng (${summary.colTotals.vd} mục) · Vận dụng cao (${summary.colTotals.vdc} mục).`;

  const dynamicSection = opts.includeDynamicMath
    ? `\n5. CÂU HỎI ĐỘNG (CHỐNG HỌC VẸT / QUAY CÓP):
- Thiết kế khoảng 2–3 câu tính toán có \`"is_dynamic": true\` dùng cú pháp biến ngẫu nhiên: \`!a:1:10!\` (nguyên từ 1..10), \`!a#0!\` (khác 0), \`{tinh: 2 * !a! + !b!}\` (tự tính giá trị cho đáp án & lời giải). Các câu còn lại để \`"is_dynamic": false\`.`
    : '';

  const topicsLine = opts.topics?.trim()
    ? opts.topics.trim()
    : 'Tổng hợp kiến thức trọng tâm theo phân phối chương trình hiện hành phù hợp với kỳ thi';

  const extraLine = opts.extraNotes?.trim()
    ? `\n- Yêu cầu bổ sung của giáo viên: ${opts.extraNotes.trim()}`
    : '';

  const crossLine =
    opts.crossSubjects && opts.crossSubjects.length > 0
      ? `\n- Tổ hợp môn tích hợp (Liên môn): ${opts.crossSubjects.join(', ')}`
      : '';

  return `Bạn là chuyên gia biên soạn đề thi cấp THPT và Đại học hàng đầu tại Việt Nam, nắm vững Chương trình GDPT 2018, Công văn 7991/BGDĐT-GDTrH và quy chế các kỳ thi Tốt nghiệp THPT, ĐGNL (HSA, V-ACT), ĐGTD (TSA), V-SAT, Học sinh giỏi.

Hãy biên soạn một đề thi hoàn chỉnh, chính xác khoa học theo đúng Ma trận 2 chiều dưới đây:

1. THÔNG TIN CHUNG:
- Môn học chính: ${opts.subjectName || 'Lớp 12'}${crossLine}
- Kỳ thi / Kiểm tra: ${examLabel}
- Thời gian làm bài: ${opts.duration} phút · Thang điểm: ${opts.maxScore || 10} điểm
- Định hướng sách giáo khoa: ${textbookLabel}
- Phạm vi chương / bài học trọng tâm: ${topicsLine}${extraLine}

2. MA TRẬN 2 CHIỀU (DẠNG THỨC CÂU HỎI × CẤP ĐỘ NĂNG LỰC — BẮT BUỘC ĐÚNG SỐ LƯỢNG):
${structureLines.join('\n')}
=> Tổng hợp cấp độ toàn đề: ${competencyNote}

3. YÊU CẦU CHUYÊN MÔN ĐẶC THÙ:
${subjectGuidance}${dynamicSection}

4. ĐỊNH DẠNG ĐẦU RA (CHỈ TRẢ VỀ JSON HỢP LỆ, KHÔNG BỌC MARKDOWN, KHÔNG VIẾT LỜI DẪN NGOÀI JSON):
- Tự giải và kiểm tra kỹ từng câu để đảm bảo \`correct_option\` khớp 100% với \`explanation\`.
- Mọi dấu gạch chéo ngược \`\\\` của LaTeX trong chuỗi JSON PHẢI escape thành \`\\\\\` (ví dụ: \`"\\\\frac{1}{2}"\`, \`"\\\\sqrt{x}"\`).
- Mẫu cấu trúc JSON bắt buộc:
{
  "title": "Đề ${examLabel} - Môn ${opts.subjectName || ''}",
  "questions": [
    {
      "type": "mcq",
      "question": "Nội dung câu hỏi...",
      "option_a": "Phương án A",
      "option_b": "Phương án B",
      "option_c": "Phương án C",
      "option_d": "Phương án D",
      "correct_option": "A",
      "difficulty_level": "easy",
      "cognitive_level": "nb",
      "explanation": "Lời giải chi tiết..."
    },
    {
      "type": "msq",
      "question": "Phần dẫn / Ngữ liệu chung...",
      "option_a": "Mệnh đề a",
      "option_b": "Mệnh đề b",
      "option_c": "Mệnh đề c",
      "option_d": "Mệnh đề d",
      "correct_option": "A,C",
      "difficulty_level": "medium",
      "cognitive_level": "th",
      "explanation": "Giải thích rõ từng ý a, b, c, d..."
    },
    {
      "type": "sa",
      "question": "Câu hỏi trả lời ngắn (nêu rõ quy tắc làm tròn)...",
      "correct_option": "12,5",
      "difficulty_level": "hard",
      "cognitive_level": "vd",
      "explanation": "Các bước tính ra 12,5..."
    }
  ]
}`;
}

/**
 * Safely parse JSON returned by Gemini or pasted by teachers, repairing common
 * unescaped LaTeX backslashes inside JSON strings and returning SA format warnings.
 */
export function parseAiExamJson(rawText: string): {
  title?: string;
  questions: any[];
  saWarnings: string[];
} {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  if (firstBrace !== -1 || firstBracket !== -1) {
    const startIdx =
      firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
    const endChar = cleaned[startIdx] === '{' ? '}' : ']';
    const lastIdx = cleaned.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, lastIdx + 1);
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const repaired = cleaned.replace(
      /"((?:\\.|[^"\\])*)"/g,
      (match) => match.replace(/\\(?!["\\/u]|n(?![a-zA-Z]))/g, '\\\\')
    );
    parsed = JSON.parse(repaired);
  }

  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Dữ liệu không chứa mảng "questions" hợp lệ.');
  }

  const saWarnings: string[] = [];
  questions.forEach((q: any, idx: number) => {
    const t = String(q?.type || '').toLowerCase().trim();
    if (t === 'sa') {
      const ans = String(q?.correct_option ?? q?.correct_answer ?? q?.answer ?? '').trim();
      const check = validateSaAnswerFormat(ans);
      if (!check.validSheetLength && check.warning) {
        saWarnings.push(`Câu #${idx + 1}: ${check.warning}`);
      }
    }
  });

  return {
    title: !Array.isArray(parsed) && typeof parsed?.title === 'string' ? parsed.title : undefined,
    questions,
    saWarnings,
  };
}

export async function callGeminiGenerateExam(params: {
  apiKey: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<{ title?: string; questions: any[]; saWarnings: string[]; rawJson: string }> {
  const key = params.apiKey.trim();
  if (!key) {
    throw new Error('Vui lòng nhập Gemini API Key để tạo đề bằng AI.');
  }

  const model = params.model || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      detail = errBody?.error?.message || detail;
    } catch {
      // ignore json parse failure
    }
    if (res.status === 400 && detail.toLowerCase().includes('api key')) {
      throw new Error('Gemini API Key không hợp lệ. Vui lòng kiểm tra lại key từ Google AI Studio.');
    }
    if (res.status === 429) {
      throw new Error('API Key đã chạm giới hạn tần suất (Quota/Rate limit 429). Vui lòng đợi 30 giây hoặc đổi sang model khác.');
    }
    throw new Error(`Lỗi gọi Gemini API: ${detail}`);
  }

  const data = await res.json();
  const textParts = (data?.candidates?.[0]?.content?.parts || [])
    .filter((p: any) => typeof p?.text === 'string' && !p?.thought)
    .map((p: any) => p.text)
    .join('\n');

  if (!textParts.trim()) {
    const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini không trả về nội dung đề thi${blockReason ? ` (Lý do: ${blockReason})` : ''}.`);
  }

  const parsed = parseAiExamJson(textParts);
  const formattedJson = JSON.stringify({ title: parsed.title, questions: parsed.questions }, null, 2);
  return {
    title: parsed.title,
    questions: parsed.questions,
    saWarnings: parsed.saWarnings,
    rawJson: formattedJson,
  };
}
