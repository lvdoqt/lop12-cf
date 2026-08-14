import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { withBase } from '../../lib/base';
import { parseMarkdownWithMath, renderMathInContainer } from '../../lib/markdown';
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

const GROUP_TYPES = ['read', 'read_cloze', 'list'];

const PEN_COLORS = [
  { label: 'Đỏ', value: '#ef4444' },
  { label: 'Xanh dương', value: '#2563eb' },
  { label: 'Xanh lá', value: '#16a34a' },
  { label: 'Đen', value: '#111827' },
  { label: 'Vàng', value: '#eab308' },
  { label: 'Trắng', value: '#ffffff' },
];

const ANSWER_BOX_CLASSES =
  'flex items-center gap-3 p-3.5 md:p-4 rounded-xl border-2 transition-all duration-150 select-none';

const LETTER_BADGE_CLASSES =
  'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0';

// ---------------------------------------------------------------------------
// Slide renderer — hiển thị 1 câu hỏi theo đúng loại (trắc nghiệm, đúng/sai, đọc hiểu…)
// ---------------------------------------------------------------------------
function SlideContent({
  question,
  start,
  count,
  showAnswer,
  showExplanation,
}: {
  question: Question & { answers: Answer[] };
  start: number;
  count: number;
  showAnswer: boolean;
  showExplanation: boolean;
}) {
  const subQuestions: any[] = (question.metadata as any)?.questions || [];
  const isReadGroup = GROUP_TYPES.includes(question.type as string);
  const isList = question.type === 'list';
  const isClozeRaw = question.type === 'read_cloze';

  const hasPlaceholders =
    isClozeRaw &&
    (/\(\d+\)/.test(question.content || '') || subQuestions.some((sq: any) => /\(\d+\)/.test(sq.question || '')));
  const isCloze = isClozeRaw && hasPlaceholders;

  let content = question.content || '';
  if (isCloze && subQuestions.length > 0) {
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
    ? 'Kỹ năng nghe'
    : isCloze
      ? 'Điền vào chỗ trống'
      : 'Đọc hiểu';

  const typeLabel: Record<string, string> = {
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
  const theoryHtml: string = (question.metadata as any)?.theory_html ?? '';

  const slideHeading = isTheory
    ? `Phần ${start}`
    : isReadGroup && subQuestions.length > 1 ? `Câu ${start} – ${start + count - 1}` : `Câu ${start}`;

  return (
    <div className="text-slate-900 dark:text-slate-100">
      {/* Tiêu đề câu */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-base font-extrabold shadow-md ${isTheory ? 'bg-emerald-600' : 'bg-blue-600'} text-white`}>
          {slideHeading}
        </span>
        <span className={`text-sm font-semibold ${isTheory ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {isReadGroup ? groupLabel : (typeLabel[question.type as string] || 'Trắc nghiệm')}
        </span>
      </div>

      {/* Nội dung câu hỏi / đoạn văn — ẩn với slide lý thuyết (heading đã hiển thị trong theory block) */}
      {!isTheory && (
        <div
          className="text-lg md:text-2xl font-semibold leading-relaxed whitespace-pre-wrap mb-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3 [&_p]:inline"
          dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(content, false) }}
        />
      )}

      {audioUrl && (
        <audio controls preload="none" className="w-full h-10 mb-5">
          <source src={audioUrl} />
        </audio>
      )}

      {/* Nhóm đọc hiểu / nghe / điền từ */}
      {isReadGroup ? (
        <ol className="space-y-6">
          {subQuestions.map((sq: any, i) => {
            const correctLetter = (sq.correct_option || '').toUpperCase();
            const questionNum = start + i;
            let displayQuestion = sq.question || '';
            if (isCloze) {
              displayQuestion = displayQuestion.replace(/\((\d+)\)/g, `(${questionNum})`);
            }
            return (
              <li key={i} className="border-t border-slate-200 dark:border-slate-700 pt-4 first:border-t-0 first:pt-0">
                <p className="text-base md:text-lg font-semibold mb-3 leading-relaxed whitespace-pre-wrap">
                  <span className="text-blue-500 dark:text-blue-400 mr-1.5 font-extrabold">Câu {questionNum}.</span>
                  <span dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(displayQuestion, false) }} />
                </p>
                <div className="space-y-2.5">
                  {OPTION_LETTERS.filter((l) => sq['option_' + l.toLowerCase()]).map((l) => {
                    const text = sq['option_' + l.toLowerCase()] || '';
                    const isCorrect = l === correctLetter;
                    const reveal = showAnswer && isCorrect;
                    return (
                      <div
                        key={l}
                        className={`${ANSWER_BOX_CLASSES} ${
                          reveal
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                            : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        <span
                          className={`${LETTER_BADGE_CLASSES} ${
                            reveal
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {l}
                        </span>
                        <span className="text-base md:text-lg font-medium flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1"
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
                  <div className="mt-3 p-4 rounded-xl bg-blue-50/50 border border-blue-100/40 dark:bg-slate-900/60 dark:border-slate-800">
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">💡 Giải thích:</p>
                    <div
                      className="text-base text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(sq.explanation || '', false) }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : question.type === 'msq' ? (
        <div className="space-y-3">
          {question.answers.map((a, i) => {
            const letter = OPTION_LETTERS[i];
            const correctChoice = a.is_correct ? 'Đúng' : 'Sai';
            return (
              <div key={a.id} className={`${ANSWER_BOX_CLASSES} border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300`}>
                <span className={`${LETTER_BADGE_CLASSES} bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300`}>
                  {letter}
                </span>
                <span className="text-base md:text-lg font-medium flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(a.content, true) }}
                />
                {showAnswer && (
                  <span
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-bold border shrink-0 ${
                      a.is_correct
                        ? 'bg-emerald-600 text-white border-transparent'
                        : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
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
            <div className="mt-2 p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20">
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">✓ Đáp án:</p>
              <div
                className="text-lg font-bold text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(question.answer, true) }}
              />
            </div>
          )}
        </div>
      ) : question.type === 'tl' ? (
        <div className="text-base md:text-lg text-slate-600 dark:text-slate-300 italic">
          (Câu tự luận — trình bày lời giải trên bảng trắng)
        </div>
      ) : (
        /* single_choice / multiple_choice / true_false / ordering */
        <div className="space-y-3">
          {question.answers.map((a, i) => {
            const letter = OPTION_LETTERS[i];
            const isCorrect = a.is_correct;
            const reveal = showAnswer && isCorrect;
            return (
              <div
                key={a.id}
                className={`${ANSWER_BOX_CLASSES} ${
                  reveal
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                    : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                }`}
              >
                <span
                  className={`${LETTER_BADGE_CLASSES} ${
                    reveal
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {letter}
                </span>
                <span className="text-base md:text-lg font-medium flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1"
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

      {/* Lời giải chi tiết cho các câu thường (không phải nhóm đọc) */}
      {showExplanation && question.explanation && !isReadGroup && (
        <div className="mt-6 p-5 rounded-xl bg-blue-50/50 border border-blue-100/40 dark:bg-slate-900/60 dark:border-slate-800">
          <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">💡 Lời giải chi tiết:</h4>
          <div
            className="text-base text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap [&_img]:max-w-full [&_img]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(question.explanation, false) }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresentationView — màn hình trình chiếu toàn màn hình + bảng trắng canvas
// ---------------------------------------------------------------------------
export default function PresentationView({ exam, questions }: PresentationViewProps) {
  const slides = useMemo(() => {
    let current = 1;
    return questions.map((question) => {
      const count = GROUP_TYPES.includes(question.type as string)
        ? ((question.metadata as any)?.questions?.length || 1)
        : 1;
      const start = current;
      current += count;
      return { question, start, count };
    });
  }, [questions]);

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
    (i: number) => setIndex(Math.max(0, Math.min(slides.length - 1, i))),
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

  // Render KaTeX cho nội dung slide (remount qua key nên DOM luôn mới)
  useEffect(() => {
    // Dùng setTimeout để đảm bảo DOM đã paint xong trước khi renderMath
    const id = setTimeout(() => renderMathInContainer(contentRef.current), 50);
    return () => clearTimeout(id);
  }, [index, showAnswer, showExplanation, wbEnabled]);

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

  // Phím tắt: ← → chuyển slide, A hiện đáp án, E hiện lời giải, F toàn màn hình
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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, toggleFullscreen]);

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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-white"
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 px-3 md:px-5 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
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
            <p className="text-[11px] text-slate-400">Trình chiếu câu hỏi</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAnswer((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
              showAnswer
                ? 'bg-emerald-600 border-emerald-500 text-white'
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
                ? 'bg-blue-600 border-blue-500 text-white'
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

      {/* ── Vùng trình chiếu + bảng trắng ───────────────────── */}
      <div ref={slideAreaRef} className="relative flex-1 overflow-auto">
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

        {/* Nội dung slide */}
        <div className="relative z-10 p-4 md:p-8 flex justify-center">
          <div
            key={`${index}:${showAnswer ? '1' : '0'}:${showExplanation ? '1' : '0'}`}
            ref={contentRef}
            className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-10"
          >
            <SlideContent
              question={currentSlide.question}
              start={currentSlide.start}
              count={currentSlide.count}
              showAnswer={showAnswer}
              showExplanation={showExplanation}
            />
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
      <footer className="flex flex-wrap items-center justify-between gap-3 px-3 md:px-5 py-2.5 bg-slate-900 border-t border-slate-800 shrink-0">
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
            Câu {index + 1} / {slides.length}
            <span className="text-slate-500 font-semibold ml-1.5">({totalQuestions} câu)</span>
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
        <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-500 font-medium">
          <span>← → chuyển slide</span>
          <span>A: đáp án</span>
          <span>E: lời giải</span>
          <span>F: toàn màn hình</span>
        </div>
      </footer>
    </div>
  );
}
