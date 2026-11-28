import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { withBase } from '../../lib/base';
import { parseMarkdownWithMath, renderMathInContainer } from '../../lib/markdown';
import { instantiateDynamicQuestion, isDynamicQuestion } from '../../lib/dynamic-quiz';
import { mulberry32, uuidToSeed } from '../../lib/random';
import type { Question, Answer } from '../../types';

interface PresentationViewProps {
  exam: { id: string; slug: string; title: string };
  questions: (Question & { answers: Answer[] })[];
}

interface Stroke {
  color: string;
  size: number;
  eraser: boolean;
  points: { x: number; y: number }[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const GROUP_TYPES = ['read', 'read_cloze', 'cloze_text', 'list'];

const PEN_COLORS = [
  { label: 'Đỏ', value: '#ef4444' },
  { label: 'Xanh dương', value: '#2563eb' },
  { label: 'Xanh lá', value: '#16a34a' },
  { label: 'Đen', value: '#111827' },
  { label: 'Vàng', value: '#eab308' },
  { label: 'Trắng', value: '#ffffff' },
];

// Bảng màu riêng biệt cho từng phương án A, B, C, D... (phong cách PowerPoint / Quiz)
const OPTION_THEMES = [
  {
    box: 'bg-sky-50/90 border-sky-200/90 text-slate-800 dark:bg-sky-950/35 dark:border-sky-800/60 dark:text-slate-100',
    badge: 'bg-sky-600 text-white shadow-sm shadow-sky-500/30',
  },
  {
    box: 'bg-amber-50/90 border-amber-200/90 text-slate-800 dark:bg-amber-950/35 dark:border-amber-800/60 dark:text-slate-100',
    badge: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
  },
  {
    box: 'bg-violet-50/90 border-violet-200/90 text-slate-800 dark:bg-violet-950/35 dark:border-violet-800/60 dark:text-slate-100',
    badge: 'bg-violet-600 text-white shadow-sm shadow-violet-500/30',
  },
  {
    box: 'bg-rose-50/90 border-rose-200/90 text-slate-800 dark:bg-rose-950/35 dark:border-rose-800/60 dark:text-slate-100',
    badge: 'bg-rose-500 text-white shadow-sm shadow-rose-500/30',
  },
  {
    box: 'bg-teal-50/90 border-teal-200/90 text-slate-800 dark:bg-teal-950/35 dark:border-teal-800/60 dark:text-slate-100',
    badge: 'bg-teal-600 text-white shadow-sm shadow-teal-500/30',
  },
  {
    box: 'bg-indigo-50/90 border-indigo-200/90 text-slate-800 dark:bg-indigo-950/35 dark:border-indigo-800/60 dark:text-slate-100',
    badge: 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30',
  },
  {
    box: 'bg-fuchsia-50/90 border-fuchsia-200/90 text-slate-800 dark:bg-fuchsia-950/35 dark:border-fuchsia-800/60 dark:text-slate-100',
    badge: 'bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-500/30',
  },
  {
    box: 'bg-cyan-50/90 border-cyan-200/90 text-slate-800 dark:bg-cyan-950/35 dark:border-cyan-800/60 dark:text-slate-100',
    badge: 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30',
  },
];

// Hiệu ứng chuyển slide kiểu PowerPoint (chọn ngẫu nhiên khi chuyển trang)
const PPT_TRANSITIONS = [
  { id: 'ppt-fade-up', label: 'Fade Up' },
  { id: 'ppt-slide-right', label: 'Push Right' },
  { id: 'ppt-slide-left', label: 'Push Left' },
  { id: 'ppt-zoom-in', label: 'Zoom' },
  { id: 'ppt-flip-in', label: '3D Unfold' },
  { id: 'ppt-swivel', label: 'Swivel' },
] as const;

const ANSWER_BOX_CLASSES =
  'flex items-center gap-3 p-3.5 md:p-4 rounded-xl border-2 transition-all duration-200 select-none shadow-sm';

const LETTER_BADGE_CLASSES =
  'w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm shrink-0';

const CORRECT_BOX_CLASSES =
  'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-500/15 ppt-answer-pop';

const CORRECT_BADGE_CLASSES = 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/40';

/** Làm nổi bật các ô số như (1), (2) ___ trong bài đọc điền từ */
function highlightClozeBlanksHtml(html: string): string {
  return html.replace(
    /\((\d+)\)(\s*_{2,})?/g,
    '<span class="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-200 font-extrabold border border-indigo-300 dark:border-indigo-700 text-[0.92em] align-baseline shadow-xs">($1)$2</span>'
  );
}

// ---------------------------------------------------------------------------
// Slide renderer — hiển thị 1 câu hỏi theo đúng loại (trắc nghiệm, đúng/sai, đọc hiểu…)
// ---------------------------------------------------------------------------
function SlideContent({
  question,
  start,
  count,
  showAnswer,
  showExplanation,
  animationsEnabled,
}: {
  question: Question & { answers: Answer[] };
  start: number;
  count: number;
  showAnswer: boolean;
  showExplanation: boolean;
  animationsEnabled: boolean;
}) {
  const [passageExpanded, setPassageExpanded] = useState(false);

  const subQuestions: any[] = (question.metadata as any)?.questions || [];
  const isReadGroup = GROUP_TYPES.includes(question.type as string);
  const isList = question.type === 'list';
  const isClozeText = question.type === 'cloze_text';
  const isClozeRaw = question.type === 'read_cloze' || isClozeText;

  const hasPlaceholders =
    isClozeRaw &&
    (/\(\d+\)/.test(question.content || '') || subQuestions.some((sq: any) => /\(\d+\)/.test(sq.question || '')));
  const isCloze = isClozeRaw && hasPlaceholders;

  let content = question.content || '';
  if ((isCloze || isClozeText) && subQuestions.length > 0) {
    const matches = Array.from(content.matchAll(/\((\d+)\)/g));
    const nums = Array.from(new Set(matches.map((m) => parseInt(m[1], 10))));
    nums.sort((a, b) => a - b);
    const numMap = new Map<number, number>();
    for (let i = 0; i < Math.min(nums.length, subQuestions.length); i++) {
      numMap.set(nums[i], start + i);
    }
    content = content.replace(/\((\d+)\)/g, (match, p1) => {
      const num = parseInt(p1, 10);
      return numMap.has(num) ? `(${numMap.get(num)})` : match;
    });
  }

  const audioUrl = (question.metadata as any)?.audio_url;

  const groupLabel = isList
    ? '🎧 Kỹ năng nghe'
    : isClozeText
      ? '✏️ Bài đọc điền từ vào ô số'
      : isCloze
        ? '✏️ Bài đọc điền vào ô số'
        : '📖 Bài đọc hiểu';

  const typeLabel: Record<string, string> = {
    mcq: 'Trắc nghiệm',
    single_choice: 'Trắc nghiệm đơn',
    multiple_choice: 'Nhiều lựa chọn',
    true_false: 'Đúng / Sai',
    ordering: 'Sắp xếp',
    msq: 'Đúng / Sai nhiều ý',
    sa: 'Trả lời ngắn',
    tl: 'Tự luận',
    theory_section: 'Lý thuyết',
  };

  const isTheory = (question.type as string) === 'theory_section';
  const isDynamic = isDynamicQuestion(question);
  const theoryHtml: string = (question.metadata as any)?.theory_html ?? '';

  const slideHeading = isTheory
    ? `Phần ${start}`
    : isReadGroup && subQuestions.length > 1 ? `Câu ${start} – ${start + count - 1}` : `Câu ${start}`;

  const renderedPassageHtml = useMemo(() => {
    const html = parseMarkdownWithMath(content, false);
    return isCloze || isClozeText ? highlightClozeBlanksHtml(html) : html;
  }, [content, isCloze, isClozeText]);

  // ── Bố cục đặc biệt cho câu hỏi nhóm (read, read_cloze, cloze_text, list):
  //    Bài đọc cố định phía trên + danh sách câu hỏi bên dưới cuộn độc lập ──
  if (isReadGroup) {
    return (
      <div className="flex flex-col h-full text-slate-900 dark:text-slate-100 overflow-hidden">
        {/* Vùng bài đọc cố định phía trên */}
        <div
          className={`shrink-0 flex flex-col border-b-2 border-indigo-200/90 dark:border-slate-700 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-sky-50/50 dark:from-slate-800/95 dark:via-slate-800/90 dark:to-indigo-950/40 transition-all duration-300 ${
            passageExpanded ? 'max-h-[62%]' : 'max-h-[44%]'
          }`}
        >
          {/* Thanh tiêu đề bài đọc */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 md:px-7 py-3 bg-white/75 dark:bg-slate-900/70 backdrop-blur-xs border-b border-amber-200/60 dark:border-slate-700/80 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-sm md:text-base font-extrabold shadow-md bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                {slideHeading}
              </span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {groupLabel}
              </span>
              {isDynamic && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  ⚡ Câu hỏi động
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] font-semibold text-amber-700/80 dark:text-amber-300/80 bg-amber-100/80 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg">
                📌 Bài đọc cố định — cuộn câu hỏi bên dưới
              </span>
              <button
                type="button"
                onClick={() => setPassageExpanded((v) => !v)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
                title={passageExpanded ? 'Thu gọn khung bài đọc' : 'Mở rộng khung bài đọc'}
              >
                {passageExpanded ? 'Thu gọn bài đọc ▲' : 'Mở rộng bài đọc ▼'}
              </button>
            </div>
          </div>

          {/* Nội dung bài đọc (cuộn riêng nếu dài) */}
          <div className="overflow-y-auto px-5 md:px-8 py-4 space-y-3">
            {audioUrl && (
              <audio controls preload="none" className="w-full h-10 rounded-lg">
                <source src={audioUrl} />
              </audio>
            )}
            <div
              className="text-base md:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3 [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: renderedPassageHtml }}
            />
          </div>
        </div>

        {/* Vùng câu hỏi bên dưới kéo lên (cuộn độc lập) */}
        <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5 bg-slate-50/80 dark:bg-slate-950/40">
          {isClozeText ? (
            /* Dạng điền 1 từ vào ô số (cloze_text) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subQuestions.map((blank: any, i: number) => {
                const blankNum = blank.number ?? start + i;
                const theme = OPTION_THEMES[i % OPTION_THEMES.length];
                const correctAns =
                  blank.correct_answer ||
                  (Array.isArray(blank.accepted_answers) ? blank.accepted_answers.join(' / ') : '') ||
                  blank.answer ||
                  '';
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border-2 p-4 shadow-sm transition-all ${
                      showAnswer ? CORRECT_BOX_CLASSES : theme.box
                    } ${animationsEnabled ? 'ppt-option-in' : ''}`}
                    style={animationsEnabled ? { animationDelay: `${Math.min(i, 7) * 55}ms` } : undefined}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`${LETTER_BADGE_CLASSES} ${showAnswer ? CORRECT_BADGE_CLASSES : theme.badge}`}>
                          {blankNum}
                        </span>
                        <span className="text-base md:text-lg font-bold">
                          Ô số ({blankNum})
                        </span>
                      </div>
                      {showAnswer ? (
                        <span className="px-3.5 py-1 rounded-xl bg-emerald-600 text-white font-extrabold text-base shadow-sm">
                          ✓ {correctAns || '—'}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg bg-white/70 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-400">
                          ___________
                        </span>
                      )}
                    </div>
                    {showExplanation && blank.explanation && (
                      <div className="mt-3 p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-blue-200/60 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-blue-600 dark:text-blue-400 mr-1">💡 Giải thích:</span>
                        <span dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(blank.explanation, true) }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Dạng đọc hiểu / điền từ trắc nghiệm / nghe (read, read_cloze, list) */
            <ol className="space-y-5">
              {subQuestions.map((sq: any, i: number) => {
                const correctLetter = (sq.correct_option || '').toUpperCase();
                const questionNum = start + i;
                let displayQuestion = sq.question || '';
                if (isCloze) {
                  displayQuestion = displayQuestion.replace(/\((\d+)\)/g, `(${questionNum})`);
                }
                const letters = OPTION_LETTERS.filter((l) => sq['option_' + l.toLowerCase()]);

                return (
                  <li
                    key={i}
                    className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${
                      animationsEnabled ? 'ppt-option-in' : ''
                    }`}
                    style={animationsEnabled ? { animationDelay: `${Math.min(i, 6) * 60}ms` } : undefined}
                  >
                    {/* Hộp câu hỏi con với nền riêng biệt */}
                    <div className="px-4 md:px-5 py-3.5 bg-gradient-to-r from-indigo-50 via-blue-50/70 to-sky-50/60 dark:from-indigo-950/50 dark:via-slate-800/80 dark:to-sky-950/30 border-b border-indigo-100 dark:border-slate-800 border-l-4 border-l-indigo-500">
                      <p className="text-base md:text-lg font-bold leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-white">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-sm font-extrabold mr-2 shadow-xs">
                          Câu {questionNum}
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: parseMarkdownWithMath(
                              displayQuestion || `Chọn đáp án đúng cho vị trí (${questionNum})`,
                              false
                            ),
                          }}
                        />
                      </p>
                    </div>

                    {/* Các phương án với màu nền riêng biệt cho A, B, C, D */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {letters.map((l, optIdx) => {
                        const text = sq['option_' + l.toLowerCase()] || '';
                        const isCorrect = l === correctLetter;
                        const reveal = showAnswer && isCorrect;
                        const dimmed = showAnswer && !isCorrect;
                        const theme = OPTION_THEMES[optIdx % OPTION_THEMES.length];

                        return (
                          <div
                            key={l}
                            className={`${ANSWER_BOX_CLASSES} ${
                              reveal ? CORRECT_BOX_CLASSES : `${theme.box} ${dimmed ? 'opacity-50' : ''}`
                            }`}
                          >
                            <span className={`${LETTER_BADGE_CLASSES} ${reveal ? CORRECT_BADGE_CLASSES : theme.badge}`}>
                              {l}
                            </span>
                            <span
                              className="text-base md:text-lg font-semibold flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1"
                              dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(text, true) }}
                            />
                            {reveal && (
                              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {showExplanation && sq.explanation && (
                      <div className="mx-4 mb-4 p-4 rounded-xl bg-blue-50/80 border border-blue-200/70 dark:bg-slate-800/70 dark:border-slate-700">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-1">💡 Giải thích:</p>
                        <div
                          className="text-sm md:text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(sq.explanation || '', false) }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    );
  }

  // ── Bố cục chuẩn (MCQ, MSQ, SA, TL, Lý thuyết) kiểu PowerPoint ──
  return (
    <div className="p-6 md:p-10 text-slate-900 dark:text-slate-100">
      {/* Tiêu đề câu */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-base font-extrabold shadow-md ${
            isTheory
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
              : 'bg-gradient-to-r from-indigo-600 to-blue-600'
          } text-white`}
        >
          {slideHeading}
        </span>
        <span
          className={`px-3 py-1 rounded-lg text-xs md:text-sm font-bold ${
            isTheory
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
          }`}
        >
          {typeLabel[question.type as string] || 'Trắc nghiệm'}
        </span>
        {isDynamic && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            ⚡ Câu hỏi động
          </span>
        )}
      </div>

      {/* Hộp nội dung câu hỏi với nền riêng biệt */}
      {!isTheory && (
        <div className="mb-6 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-blue-50/75 to-sky-50/80 dark:from-indigo-950/45 dark:via-slate-800/90 dark:to-sky-950/35 border-2 border-indigo-200/80 dark:border-indigo-800/50 border-l-[6px] border-l-indigo-500 shadow-sm">
          <div
            className="text-lg md:text-2xl font-bold leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-white [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3 [&_p]:inline"
            dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(content, false) }}
          />
        </div>
      )}

      {audioUrl && (
        <audio controls preload="none" className="w-full h-10 mb-5">
          <source src={audioUrl} />
        </audio>
      )}

      {question.type === 'msq' ? (
        <div className="space-y-3">
          {question.answers.map((a, i) => {
            const letter = OPTION_LETTERS[i];
            const theme = OPTION_THEMES[i % OPTION_THEMES.length];
            const correctChoice = a.is_correct ? '✓ Đúng' : '✕ Sai';
            return (
              <div
                key={a.id}
                className={`${ANSWER_BOX_CLASSES} ${theme.box} ${animationsEnabled ? 'ppt-option-in' : ''}`}
                style={animationsEnabled ? { animationDelay: `${i * 65}ms` } : undefined}
              >
                <span className={`${LETTER_BADGE_CLASSES} ${theme.badge}`}>
                  {letter}
                </span>
                <span
                  className="text-base md:text-lg font-semibold flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(a.content, true) }}
                />
                {showAnswer && (
                  <span
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-extrabold border shrink-0 ppt-answer-pop ${
                      a.is_correct
                        ? 'bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-500/30'
                        : 'bg-rose-600 text-white border-transparent shadow-sm shadow-rose-500/30'
                    }`}
                  >
                    {correctChoice}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : isTheory ? (
        /* Slide lý thuyết — hiển thị heading + HTML body */
        <div className="space-y-4">
          <h2
            className="text-xl md:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 leading-snug"
            dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(question.content, false) }}
          />
          <div
            className="text-base md:text-lg leading-relaxed
              [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-slate-800 [&_h3]:dark:text-slate-100
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-2
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-2
              [&_li]:leading-relaxed
              [&_strong]:font-bold [&_em]:italic
              [&_p]:my-1.5 [&_p]:leading-relaxed
              [&_div[style]]:rounded-lg [&_div[style]]:my-2 [&_div[style]]:px-2
              [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3"
            dangerouslySetInnerHTML={{ __html: theoryHtml }}
          />
        </div>
      ) : question.type === 'sa' ? (
        <div>
          {showAnswer && question.answer && (
            <div className="mt-2 p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-400/40 shadow-md ppt-answer-pop">
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mb-1.5 uppercase tracking-wide">✓ Đáp án chính xác</p>
              <div
                className="text-xl md:text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(question.answer, true) }}
              />
            </div>
          )}
        </div>
      ) : question.type === 'tl' ? (
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-base md:text-lg text-amber-800 dark:text-amber-300 font-medium italic">
          ✏️ Câu tự luận — bật Bảng trắng bên dưới để trình bày lời giải trực tiếp
        </div>
      ) : (
        /* single_choice / mcq / multiple_choice / true_false / ordering — màu riêng cho từng đáp án */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {question.answers.map((a, i) => {
            const letter = OPTION_LETTERS[i];
            const isCorrect = a.is_correct;
            const reveal = showAnswer && isCorrect;
            const dimmed = showAnswer && !isCorrect;
            const theme = OPTION_THEMES[i % OPTION_THEMES.length];

            return (
              <div
                key={a.id}
                className={`${ANSWER_BOX_CLASSES} ${
                  reveal ? CORRECT_BOX_CLASSES : `${theme.box} ${dimmed ? 'opacity-50' : ''}`
                } ${animationsEnabled ? 'ppt-option-in' : ''}`}
                style={animationsEnabled ? { animationDelay: `${i * 65}ms` } : undefined}
              >
                <span className={`${LETTER_BADGE_CLASSES} ${reveal ? CORRECT_BADGE_CLASSES : theme.badge}`}>
                  {letter}
                </span>
                <span
                  className="text-base md:text-lg font-semibold flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(a.content, true) }}
                />
                {reveal && (
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lời giải chi tiết */}
      {showExplanation && question.explanation && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border-2 border-blue-200/70 dark:from-slate-800/80 dark:to-indigo-950/30 dark:border-slate-700 shadow-sm ppt-answer-pop">
          <h4 className="text-sm font-extrabold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">💡 Lời giải chi tiết</h4>
          <div
            className="text-base text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap [&_img]:max-w-full [&_img]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(question.explanation, false) }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresentationView — màn hình trình chiếu kiểu PowerPoint + bảng trắng canvas
// ---------------------------------------------------------------------------
export default function PresentationView({ exam, questions }: PresentationViewProps) {
  const [dynamicSeed, setDynamicSeed] = useState<number>(() => uuidToSeed(exam.id || 'presentation'));
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [transitionIndex, setTransitionIndex] = useState(0);

  const hasDynamicQuestions = useMemo(
    () => questions.some((q) => isDynamicQuestion(q)),
    [questions]
  );

  const resolvedQuestions = useMemo(() => {
    if (!hasDynamicQuestions) return questions;
    const prng = mulberry32(dynamicSeed);
    return questions.map((q) => instantiateDynamicQuestion(q, prng));
  }, [questions, hasDynamicQuestions, dynamicSeed]);

  const rerollDynamic = useCallback(() => {
    setDynamicSeed((s) => ((s + 1 + Math.floor(Math.random() * 1_000_000)) | 0));
  }, []);

  const slides = useMemo(() => {
    let current = 1;
    return resolvedQuestions.map((question) => {
      const count = GROUP_TYPES.includes(question.type as string)
        ? ((question.metadata as any)?.questions?.length || 1)
        : 1;
      const start = current;
      current += count;
      return { question, start, count };
    });
  }, [resolvedQuestions]);

  const totalQuestions =
    slides.length > 0 ? slides[slides.length - 1].start + slides[slides.length - 1].count - 1 : 0;

  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [wbEnabled, setWbEnabled] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Map<number, Stroke[]>>(new Map());
  const activeStrokeRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, i));
      setIndex((prevIdx) => {
        if (clamped !== prevIdx) {
          // Chọn ngẫu nhiên 1 hiệu ứng PowerPoint khác với hiệu ứng vừa dùng
          setTransitionIndex((prevT) => {
            if (PPT_TRANSITIONS.length <= 1) return 0;
            let nextT = Math.floor(Math.random() * PPT_TRANSITIONS.length);
            if (nextT === prevT) nextT = (nextT + 1) % PPT_TRANSITIONS.length;
            return nextT;
          });
        }
        return clamped;
      });
    },
    [slides.length]
  );
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // ---- Bảng trắng: vẽ lại toàn bộ nét của slide hiện tại ----
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const strokes = [
      ...(strokesRef.current.get(index) || []),
      ...(activeStrokeRef.current ? [activeStrokeRef.current] : []),
    ];
    for (const s of strokes) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.eraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
      }
      ctx.lineWidth = s.size;
      if (s.points.length === 1) {
        ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [index]);

  // Cân chỉnh kích thước canvas theo vùng slide
  useEffect(() => {
    const area = slideAreaRef.current;
    const canvas = canvasRef.current;
    if (!area || !canvas) return;
    const resize = () => {
      const rect = area.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      redrawAll();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(area);
    return () => ro.disconnect();
  }, [redrawAll]);

  // Khi chuyển slide: hủy nét đang vẽ + vẽ lại nét của slide mới
  useEffect(() => {
    activeStrokeRef.current = null;
    drawingRef.current = false;
    redrawAll();
  }, [index, redrawAll]);

  // Render KaTeX cho nội dung slide
  useEffect(() => {
    const id = setTimeout(() => renderMathInContainer(contentRef.current), 50);
    return () => clearTimeout(id);
  }, [index, showAnswer, showExplanation, wbEnabled, dynamicSeed]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!wbEnabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    activeStrokeRef.current = {
      color: tool === 'eraser' ? '#000000' : color,
      size: tool === 'eraser' ? brushSize * 4 : brushSize,
      eraser: tool === 'eraser',
      points: [getPoint(e)],
    };
    redrawAll();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    activeStrokeRef.current?.points.push(getPoint(e));
    redrawAll();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const s = activeStrokeRef.current;
    if (s && s.points.length > 0) {
      const arr = strokesRef.current.get(index) || [];
      arr.push(s);
      strokesRef.current.set(index, arr);
    }
    activeStrokeRef.current = null;
    redrawAll();
  };

  const clearWhiteboard = () => {
    strokesRef.current.set(index, []);
    activeStrokeRef.current = null;
    redrawAll();
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Phím tắt: ← → chuyển slide, A hiện đáp án, E hiện lời giải, R đổi số liệu động, F toàn màn hình
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'a') {
        setShowAnswer((v) => !v);
      } else if (e.key.toLowerCase() === 'e') {
        setShowExplanation((v) => !v);
      } else if (e.key.toLowerCase() === 'r' && hasDynamicQuestions) {
        rerollDynamic();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, toggleFullscreen, hasDynamicQuestions, rerollDynamic]);

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-3xl">!</div>
          <h2 className="text-xl font-extrabold mb-2">Đề thi chưa có câu hỏi</h2>
          <p className="text-sm text-slate-400 mb-6">Hãy thêm câu hỏi vào đề trước khi trình chiếu.</p>
          <a
            href={withBase('/giao-vien/trinh-chieu')}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
          >
            Quay lại chọn đề
          </a>
        </div>
      </div>
    );
  }

  const currentSlide = slides[index];
  const isCurrentGroup = GROUP_TYPES.includes(currentSlide.question.type as string);
  const currentTransition = PPT_TRANSITIONS[transitionIndex] || PPT_TRANSITIONS[0];
  const progressPct = ((index + 1) / slides.length) * 100;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black flex flex-col text-white"
    >
      {/* PowerPoint CSS Keyframes */}
      <style>{`
        @keyframes pptFadeUp {
          0% { opacity: 0; transform: translateY(28px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pptSlideRight {
          0% { opacity: 0; transform: translateX(64px) scale(0.98); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pptSlideLeft {
          0% { opacity: 0; transform: translateX(-64px) scale(0.98); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pptZoomIn {
          0% { opacity: 0; transform: scale(0.88); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pptFlipIn {
          0% { opacity: 0; transform: perspective(1200px) rotateX(14deg) translateY(22px); }
          100% { opacity: 1; transform: perspective(1200px) rotateX(0deg) translateY(0); }
        }
        @keyframes pptSwivel {
          0% { opacity: 0; transform: scale(0.92) rotate(-1.5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes pptOptionIn {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pptAnswerPop {
          0% { transform: scale(0.97); }
          55% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        .ppt-fade-up { animation: pptFadeUp 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ppt-slide-right { animation: pptSlideRight 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ppt-slide-left { animation: pptSlideLeft 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ppt-zoom-in { animation: pptZoomIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ppt-flip-in { animation: pptFlipIn 0.48s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: top center; }
        .ppt-swivel { animation: pptSwivel 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ppt-option-in { animation: pptOptionIn 0.36s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .ppt-answer-pop { animation: pptAnswerPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 px-3 md:px-5 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href={withBase('/giao-vien/trinh-chieu')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800 transition shrink-0"
            title="Thoát trình chiếu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Thoát
          </a>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-extrabold truncate">{exam.title}</h1>
            <p className="text-[11px] text-slate-400">
              Trình chiếu PowerPoint
              {animationsEnabled && (
                <span className="ml-2 text-indigo-400">• Hiệu ứng: {currentTransition.label}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAnimationsEnabled((v) => !v)}
            className={`hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-bold border transition items-center gap-1.5 ${
              animationsEnabled
                ? 'bg-indigo-600/25 border-indigo-500/70 text-indigo-200 hover:bg-indigo-600 hover:text-white'
                : 'border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
            title="Bật/tắt hiệu ứng chuyển slide ngẫu nhiên"
          >
            <span>✨</span>
            {animationsEnabled ? 'Hiệu ứng: BẬT' : 'Hiệu ứng: TẮT'}
          </button>
          {hasDynamicQuestions && (
            <button
              onClick={rerollDynamic}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-violet-500/70 bg-violet-600/20 text-violet-200 hover:bg-violet-600 hover:text-white transition flex items-center gap-1.5"
              title="Tạo bộ số liệu ngẫu nhiên mới cho các câu hỏi động (Phím tắt: R)"
            >
              <span>🎲</span>
              Đổi số liệu
            </button>
          )}
          <button
            onClick={() => setShowAnswer((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
              showAnswer
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Phím tắt: A"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showAnswer ? 'Ẩn đáp án' : 'Hiện đáp án'}
          </button>
          <button
            onClick={() => setShowExplanation((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
              showExplanation
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Phím tắt: E"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {showExplanation ? 'Ẩn lời giải' : 'Hiện lời giải'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 transition flex items-center gap-1.5"
            title="Phím tắt: F"
          >
            {isFullscreen ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M9 15v4.5M9 15H4.5M15 15h4.5M15 15v4.5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Thanh tiến độ slide kiểu PowerPoint */}
      <div className="h-1 w-full bg-slate-800 shrink-0 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Vùng trình chiếu + bảng trắng ───────────────────── */}
      <div
        ref={slideAreaRef}
        className={`relative flex-1 ${isCurrentGroup ? 'overflow-hidden' : 'overflow-auto'}`}
      >
        {/* Canvas bảng trắng (trong suốt, vẽ đè lên slide) */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-20 w-full h-full ${wbEnabled ? '' : 'pointer-events-none'}`}
          style={{ touchAction: wbEnabled ? 'none' : 'auto', cursor: wbEnabled ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* Khung slide PowerPoint */}
        <div
          className={`relative z-10 p-3 md:p-6 flex justify-center ${
            isCurrentGroup ? 'h-full' : 'min-h-full items-start md:items-center'
          }`}
        >
          <div
            key={`${index}:${dynamicSeed}`}
            className={`w-full ${isCurrentGroup ? 'max-w-5xl h-full flex flex-col' : 'max-w-4xl'} bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.65)] border border-slate-200/80 dark:border-slate-700/80 overflow-hidden ${
              animationsEnabled ? currentTransition.id : ''
            }`}
          >
            {/* Dải màu trang trí đầu slide kiểu PowerPoint */}
            <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-indigo-500 via-50% to-rose-500 shrink-0" />

            <div
              ref={contentRef}
              className={isCurrentGroup ? 'flex-1 min-h-0 flex flex-col' : ''}
            >
              <SlideContent
                question={currentSlide.question}
                start={currentSlide.start}
                count={currentSlide.count}
                showAnswer={showAnswer}
                showExplanation={showExplanation}
                animationsEnabled={animationsEnabled}
              />
            </div>
          </div>
        </div>

        {/* Nhắc bảng trắng khi đang vẽ */}
        {wbEnabled && (
          <div className="absolute top-3 right-4 z-30 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold shadow-lg">
            ✏️ Đang vẽ trên bảng trắng — tắt để cuộn
          </div>
        )}
      </div>

      {/* ── Bottom bar: điều hướng + công cụ bảng trắng ─────── */}
      <footer className="flex flex-wrap items-center justify-between gap-3 px-3 md:px-5 py-2.5 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shrink-0">
        {/* Điều hướng */}
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            disabled={index === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Trước
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm font-bold text-slate-200">
            Slide {index + 1} / {slides.length}
            <span className="text-slate-400 font-semibold ml-1.5">({totalQuestions} câu)</span>
          </span>
          <button
            onClick={next}
            disabled={index === slides.length - 1}
            className="px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            Sau
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Bảng trắng */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setWbEnabled((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              wbEnabled
                ? 'bg-amber-500 border-amber-400 text-white'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {wbEnabled ? 'Bảng trắng: BẬT' : 'Bảng trắng'}
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block" />

          <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded-lg border transition ${
              tool === 'pen' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Bút vẽ"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg border transition ${
              tool === 'eraser' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Tẩy"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 17v2a2 2 0 01-2 2H9l-6-6 9-9 9 9zM3 21l3-3" />
            </svg>
          </button>
          <button
            onClick={clearWhiteboard}
            className="p-2 rounded-lg border border-slate-700 text-rose-400 hover:bg-rose-500/10 transition"
            title="Xóa nét vẽ trên slide này"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1">
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => { setColor(c.value); setTool('pen'); }}
                className={`w-5 h-5 rounded-full border-2 transition ${color === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>

          <input
            type="range"
            min={1}
            max={12}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 ml-1 accent-blue-500"
            title="Độ dày nét vẽ"
          />
        </div>

        {/* Gợi ý phím tắt */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-400 font-medium">
          <span>← → chuyển slide</span>
          <span>A: đáp án</span>
          <span>E: lời giải</span>
          {hasDynamicQuestions && <span>R: đổi số liệu</span>}
          <span>F: toàn màn hình</span>
        </div>
      </footer>
    </div>
  );
}
