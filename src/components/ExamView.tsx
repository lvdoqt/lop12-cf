import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import QuestionCard from './QuestionCard';
import ReadListQuestion from './ReadListQuestion';
import type { Question, Answer } from '../types';

interface ExamViewProps {
  exam: {
    id: string;
    slug: string;
    title: string;
    duration: number;
  };
  attempt: {
    id: string;
  };
  questions: (Question & { answers: Answer[] })[];
  initialSeconds: number;
}

type AnswersMap = Record<string, string | string[] | Record<string, string>>;

const MCQ_TYPES = ['single_choice', 'multiple_choice', 'true_false'];

const SECTION_COLORS = {
  mcq: {
    bg: 'from-green-400 to-green-500',
    light: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-900/40',
    text: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    nav: 'bg-green-500',
    label: 'Câu trắc nghiệm nhiều phương án lựa chọn',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  multiple_choice: {
    bg: 'from-blue-400 to-blue-500',
    light: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    nav: 'bg-blue-500',
    label: 'Câu hỏi chọn nhiều đáp án',
    icon: 'M4 6h16M4 12h16M4 18h16',
  },
  msq: {
    bg: 'from-violet-500 to-purple-600',
    light: 'bg-violet-50 dark:bg-violet-950/20',
    border: 'border-violet-200 dark:border-violet-900/40',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    nav: 'bg-violet-500',
    label: 'Câu trắc nghiệm đúng sai',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  sa: {
    bg: 'from-amber-500 to-orange-500',
    light: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    nav: 'bg-amber-500',
    label: 'Câu trắc nghiệm trả lời ngắn',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  true_false: {
    bg: 'from-orange-500 to-red-500',
    light: 'bg-orange-50 dark:bg-orange-950/20',
    border: 'border-orange-200 dark:border-orange-900/40',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    nav: 'bg-orange-500',
    label: 'Câu trắc nghiệm đúng/sai đơn',
    icon: 'M5 13l4 4L19 7',
  },
  tl: {
    bg: 'from-emerald-500 to-teal-600',
    light: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    nav: 'bg-emerald-500',
    label: 'Câu tự luận',
    icon: 'M4 6h16M4 12h16M4 18h7',
  },
  read: {
    bg: 'from-indigo-500 to-purple-600',
    light: 'bg-indigo-50 dark:bg-indigo-950/20',
    border: 'border-indigo-200 dark:border-indigo-900/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    nav: 'bg-indigo-500',
    label: 'Kỹ năng đọc hiểu',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  list: {
    bg: 'from-cyan-500 to-blue-600',
    light: 'bg-cyan-50 dark:bg-cyan-950/20',
    border: 'border-cyan-200 dark:border-cyan-900/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    nav: 'bg-cyan-500',
    label: 'Kỹ năng nghe',
    icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
  },
} as const;

type SectionKey = keyof typeof SECTION_COLORS;

export default function ExamView({ exam, attempt, questions, initialSeconds }: ExamViewProps) {
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const classified = useMemo(() => {
    let currentIndex = 1;
    const withIndex = questions.map((q) => {
      let section: SectionKey = 'mcq';
      if (q.type === 'multiple_choice') section = 'multiple_choice';
      else if (q.type === 'true_false') section = 'true_false';
      else if (q.type === 'msq') section = 'msq';
      else if (q.type === 'sa') section = 'sa';
      else if (q.type === 'tl') section = 'tl';
      else if (q.type === 'read') section = 'read';
      else if (q.type === 'list') section = 'list';
      
      const startIndex = currentIndex;
      let count = 1;
      if (q.type === 'read' || q.type === 'list') {
        count = (q.metadata as any)?.questions?.length || 1;
      }
      currentIndex += count;

      return { ...q, globalIndex: startIndex, section };
    });
    return {
      mcq: withIndex.filter(q => q.type === 'single_choice'),
      multiple_choice: withIndex.filter(q => q.type === 'multiple_choice'),
      msq: withIndex.filter(q => q.type === 'msq'),
      sa: withIndex.filter(q => q.type === 'sa'),
      true_false: withIndex.filter(q => q.type === 'true_false'),
      tl: withIndex.filter(q => q.type === 'tl'),
      read: withIndex.filter(q => q.type === 'read'),
      list: withIndex.filter(q => q.type === 'list'),
      all: withIndex,
    };
  }, [questions]);

  const flatNavigatorItems = useMemo(() => {
    let items: any[] = [];
    classified.all.forEach(q => {
      const isReadList = q.type === 'read' || q.type === 'list';
      if (isReadList) {
        const numSub = (q.metadata as any)?.questions?.length || 1;
        for (let i = 0; i < numSub; i++) {
          items.push({
             ...q,
             subIndex: i,
             displayIndex: q.globalIndex + i,
             isSub: true
          });
        }
      } else {
         items.push({
            ...q,
            displayIndex: q.globalIndex,
            isSub: false
         });
      }
    });
    return items;
  }, [classified.all]);

  const handleAnswer = useCallback((questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handleReadListAnswer = useCallback((parentId: string, subIndex: number, letter: string) => {
    setAnswers(prev => {
      const prevMap = prev[parentId] && typeof prev[parentId] === 'object' && !Array.isArray(prev[parentId])
        ? (prev[parentId] as Record<string, string>)
        : {};
      return { ...prev, [parentId]: { ...prevMap, [subIndex]: letter } };
    });
  }, []);

  // Total / answered sub-items (read/list count each sub-question)
  const { totalItems, answeredItems } = useMemo(() => {
    let total = 0;
    let answered = 0;
    questions.forEach(q => {
      if (q.type === 'read' || q.type === 'list') {
        const n = (q.metadata as any)?.questions?.length || 0;
        total += n;
        const m = answers[q.id];
        if (m && typeof m === 'object' && !Array.isArray(m)) {
          answered += Object.keys(m as object).length;
        }
      } else {
        total += 1;
        const a = answers[q.id];
        if (a !== undefined && !(Array.isArray(a) && (a as any[]).length === 0)) {
          answered += 1;
        }
      }
    });
    return { totalItems: total, answeredItems: answered };
  }, [questions, answers]);

  const handleSubmitRef = useRef<() => void>(null!);
  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    if (!auto) {
      setConfirmOpen(false);
    }

    try {
      const res = await fetch(import.meta.env.BASE_URL + '/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, answers }),
      });

      if (res.ok) {
        window.location.href = `${import.meta.env.BASE_URL}/exams/${exam.slug}/result/${attempt.id}`;
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message || 'Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
        setSubmitting(false);
      }
    } catch {
      setError('Lỗi kết nối mạng, vui lòng thử lại.');
      setSubmitting(false);
    }
  }, [submitting, attempt.id, exam.slug, answers]);

  handleSubmitRef.current = () => handleSubmit(true);

  // Timer — uses ref to avoid stale closure
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !submitting) {
        setConfirmOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submitting]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isLowTime = timeLeft < 60;
  const isCritical = timeLeft < 300;
  const progress = exam.duration > 0 ? ((exam.duration * 60 - timeLeft) / (exam.duration * 60)) * 100 : 0;

  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-10 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Đề thi chưa có câu hỏi</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Đề thi này hiện chưa được thêm câu hỏi. Vui lòng quay lại sau hoặc liên hệ giáo viên.
          </p>
          <a
            href="/de-thi"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            Quay lại danh sách đề thi
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-4 relative">
      {/* Main content */}
      <div className="lg:col-span-3 space-y-6">
        <div className={`px-6 py-4 rounded-2xl shadow-md flex items-center justify-between ${
          isCritical ? 'bg-rose-600' : 'bg-blue-600'
        } text-white`}>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
              {isLowTime ? '⚠️ Sắp hết giờ' : 'Đang thi trực tuyến'}
            </span>
            <h1 className="text-lg md:text-xl font-extrabold leading-tight truncate">{exam.title}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-3 ml-4 shrink-0">
            <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
              <div className="text-xs font-semibold text-white/70">Đã làm</div>
              <div className="text-lg font-black">{answeredItems}/{totalItems}</div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex items-center gap-3 text-sm font-semibold text-rose-700 dark:text-rose-400">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-10">
          {(() => {
            const keys: SectionKey[] = ['mcq', 'multiple_choice', 'msq', 'sa', 'true_false', 'tl', 'read', 'list'];
            const activeKeys = keys.filter(key => classified[key].length > 0);
            const Roman = (n: number) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n - 1] || String(n);
            
            return activeKeys.map((key, index) => {
              const items = classified[key];
              const color = SECTION_COLORS[key];
              const sectionNum = Roman(index + 1);
            return (
              <div key={key} className="space-y-4">
                <div className={`rounded-2xl overflow-hidden border ${color.border}`}>
                  <div className={`bg-gradient-to-r ${color.bg} px-6 py-4 flex items-center gap-3`}>
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d={color.icon} />
                      </svg>
                    </div>
                    <div>
                      <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Phần {sectionNum}</span>
                      <h2 className="text-lg font-extrabold text-white leading-tight">{color.label}</h2>
                    </div>
                    <div className="ml-auto bg-white/20 rounded-xl px-3 py-1.5 text-white text-xs font-bold">
                      {items.length} câu
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {items.map(q =>
                    (key === 'read' || key === 'list') ? (
                      <ReadListQuestion
                        key={q.id}
                        question={q}
                        index={q.globalIndex}
                        mode="take"
                        selectedAnswers={(answers[q.id] as Record<string, string>) || undefined}
                        onAnswer={handleReadListAnswer}
                      />
                    ) : (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        index={q.globalIndex}
                        mode="take"
                        selectedAnswer={answers[q.id]}
                        onAnswer={handleAnswer}
                        sectionKey={(q.section === 'read' || q.section === 'list') ? 'mcq' : q.section}
                      />
                    )
                  )}
                </div>
              </div>
            );
            });
          })()}
        </div>
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-1">
        <div className="sticky top-20 space-y-6">
          {/* Timer */}
          <div className={`rounded-2xl p-6 shadow-sm text-center transition-all duration-300 border ${
            isLowTime
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
              : 'bg-white dark:bg-slate-900 border-gray-250 dark:border-slate-800/80'
          }`}>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Thời gian còn lại</p>
            <div className={`text-3xl md:text-4xl font-black mt-2 font-mono tracking-wider transition-colors ${
              isLowTime
                ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              {timeDisplay}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isLowTime ? 'bg-rose-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 font-medium">
              {answeredItems}/{totalItems} câu đã làm
            </p>
          </div>

          {/* Navigator */}
          <div className="bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Mục lục câu hỏi</h3>
            <div className="grid grid-cols-5 gap-2">
              {flatNavigatorItems.map(item => {
                const isMsq = item.type === 'msq';
                let answered = false;
                let isPartial = false;
                
                if (item.isSub) {
                   const sel = answers[item.id] as Record<string, string>;
                   answered = !!(sel && sel[item.subIndex]);
                } else {
                   answered = answers[item.id] !== undefined;
                   isPartial = isMsq && typeof answers[item.id] === 'object' && Object.keys(answers[item.id] as object).length > 0;
                }

                const sectionColor = SECTION_COLORS[item.section as SectionKey];

                let btnClass = 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 border-gray-200/50 dark:border-slate-700';
                if (answered || isPartial) {
                  btnClass = `${sectionColor.nav} text-white border-transparent`;
                }

                return (
                  <a
                    key={item.isSub ? `${item.id}-${item.subIndex}` : item.id}
                    href={`#question-section-${item.globalIndex}`}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border hover:opacity-80 transition ${btnClass}`}
                    title={`Câu ${item.displayIndex}`}
                  >
                    {item.displayIndex}
                  </a>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 text-[10px] font-semibold text-gray-400 dark:text-slate-500 flex-wrap">
              {(() => {
                const keys: SectionKey[] = ['mcq', 'multiple_choice', 'msq', 'sa', 'true_false', 'tl', 'read', 'list'];
                const activeKeys = keys.filter(key => classified[key].length > 0);
                const Roman = (n: number) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n - 1] || String(n);
                
                return activeKeys.map((key, index) => {
                  const color = SECTION_COLORS[key];
                  return (
                    <span key={key} className="flex items-center gap-1">
                      <span className={`w-3 h-3 rounded ${color.nav}`} />
                      Phần {Roman(index + 1)}
                    </span>
                  );
                });
              })()}
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-gray-200 dark:bg-slate-700" />
                Chưa làm
              </span>
            </div>

            <div className="h-px bg-gray-100 dark:bg-slate-800 my-6" />

            {/* Submit */}
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-rose-500/20 hover:shadow-rose-500/25 transition text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Đang chấm điểm...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Nộp bài thi</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center mt-2">
              Ctrl+Enter để nộp bài nhanh
            </p>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm mx-4 w-full border border-gray-200 dark:border-slate-800">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 19.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Xác nhận nộp bài</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                Bạn đã làm <strong className="text-gray-700 dark:text-slate-300">{answeredItems}/{totalItems}</strong> câu.
              </p>
              {answeredItems < totalItems && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-4">
                  Còn {totalItems - answeredItems} câu chưa được trả lời!
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                Sau khi nộp, bạn sẽ không thể thay đổi đáp án.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 px-4 py-3 border border-gray-250 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold rounded-xl transition text-sm"
                >
                  Tiếp tục làm bài
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold rounded-xl transition text-sm"
                >
                  {submitting ? 'Đang nộp...' : 'Xác nhận nộp bài'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-submit overlay */}
      {timeLeft === 0 && submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm mx-4 w-full text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-rose-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">⏱️ Hết giờ làm bài!</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Hệ thống đang tự động nộp bài thi của bạn...</p>
          </div>
        </div>
      )}
    </div>
  );
}
