import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Answer, Question } from '../types';
import QuestionCard from './QuestionCard';
import ReadListQuestion from './ReadListQuestion';
import MatchingQuestion from './MatchingQuestion';
import ClozeTextQuestion from './ClozeTextQuestion';

type Q = Question & { answers: Answer[] };
type Props = { exam: { slug: string; title: string; duration: number }; attempt: { id: string }; questions: Q[]; initialSeconds: number };
type AnswerMap = Record<string, string | string[] | Record<string, string>>;

const labels: Record<string, string> = { mcq: 'Chọn đáp án', msq: 'Đúng / Sai', read: 'Chọn đáp án', single_choice: 'Chọn đáp án', matching: 'Ghép cặp', sa: 'Trả lời ngắn', cloze_text: 'Điền một từ' };

export default function VSatExamView({ exam, attempt, questions, initialSeconds }: Props) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [time, setTime] = useState(initialSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const submitRef = useRef<() => void>(() => undefined);
  const indexed = useMemo(() => {
    let current = 1;
    return questions.map(q => {
      const displayIndex = current;
      const itemCount = q.type === 'read' || q.type === 'cloze_text' ? ((q.metadata as any)?.questions?.length || 1) : 1;
      current += itemCount;
      return { ...q, displayIndex, itemCount };
    });
  }, [questions]);
  const answered = useMemo(() => indexed.reduce((total, q) => {
    const a = answers[q.id];
    if ((q.type === 'read' || q.type === 'cloze_text') && a && typeof a === 'object' && !Array.isArray(a)) return total + Object.values(a).filter(Boolean).length;
    if (q.type === 'msq') return total + (a && typeof a === 'object' && Object.keys(a).length === q.answers.length ? 1 : 0);
    if (q.type === 'matching') return total + (a && typeof a === 'object' && Object.keys(a).length === ((q.metadata as any)?.questions?.length || 0) ? 1 : 0);
    return total + (a !== undefined && a !== '' ? 1 : 0);
  }, 0), [answers, indexed]);
  const totalItems = useMemo(() => indexed.reduce((n, q) => n + q.itemCount, 0), [indexed]);

  const setAnswer = useCallback((id: string, value: any) => setAnswers(a => ({ ...a, [id]: value })), []);
  const setSubAnswer = useCallback((id: string, i: number, value: string) => setAnswers(a => ({ ...a, [id]: { ...(typeof a[id] === 'object' && !Array.isArray(a[id]) ? a[id] as object : {}), [i]: value } })), []);
  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true); setConfirm(false); setError('');
    try {
      const res = await fetch(import.meta.env.BASE_URL + '/api/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId: attempt.id, answers }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Không thể nộp bài.');
      location.href = `${import.meta.env.BASE_URL}/exams/${exam.slug}/result/${attempt.id}`;
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }, [answers, attempt.id, exam.slug, submitting]);
  submitRef.current = submit;
  useEffect(() => { const t = setInterval(() => setTime(v => { if (v <= 1) { clearInterval(t); submitRef.current(); return 0; } return v - 1; }), 1000); return () => clearInterval(t); }, []);

  const mm = String(Math.floor(time / 60)).padStart(2, '0');
  const ss = String(time % 60).padStart(2, '0');
  return <div className="min-h-screen bg-[#edf2f5] -mx-4 -my-6 md:-mx-8 md:-my-8">
    <header className="sticky top-0 z-30 border-b border-slate-300 bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#075985] text-sm font-black text-white">V</div>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-700">Kỳ thi V-SAT · Mô phỏng trên máy tính</p><h1 className="truncate text-sm font-bold text-slate-800 md:text-base">{exam.title}</h1></div>
        <div className={`rounded-lg border px-4 py-2 text-center ${time < 300 ? 'border-red-300 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-900'}`}><small className="block text-[9px] font-bold uppercase">Thời gian còn lại</small><b className="font-mono text-xl">{mm}:{ss}</b></div>
      </div>
    </header>
    <main className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><b>Hướng dẫn:</b> Chọn câu ở bảng bên phải để di chuyển. Câu Đúng/Sai cần trả lời đủ mọi mệnh đề; câu Ghép cặp chọn một chữ cái cho từng ý. Bài tự nộp khi hết giờ.</div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {indexed.map(q => q.type === 'matching' ? <MatchingQuestion key={q.id} question={q} index={q.displayIndex} selected={answers[q.id] as Record<string,string>} onAnswer={setSubAnswer} /> : q.type === 'cloze_text' ? <ClozeTextQuestion key={q.id} question={q} index={q.displayIndex} selected={answers[q.id] as Record<string,string>} onAnswer={setSubAnswer} /> : q.type === 'read' ? <ReadListQuestion key={q.id} question={q} index={q.displayIndex} mode="take" selectedAnswers={answers[q.id] as Record<string,string>} onAnswer={setSubAnswer} /> : <QuestionCard key={q.id} question={q} index={q.displayIndex} mode="take" selectedAnswer={answers[q.id]} onAnswer={setAnswer} sectionKey={q.type === 'msq' ? 'msq' : q.type === 'sa' ? 'sa' : 'mcq'} />)}
      </div>
      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
        <div className="mb-3 flex justify-between text-sm"><b>Phiếu trả lời</b><span className="text-slate-500">{answered}/{totalItems} câu</span></div>
        <div className="mb-5 grid grid-cols-5 gap-2">{indexed.flatMap(q => Array.from({ length: q.itemCount }, (_, i) => { const a = answers[q.id]; const done = q.itemCount === 1 ? Boolean(a) : Boolean(a && typeof a === 'object' && !Array.isArray(a) && (a as Record<string,string>)[String(i)]); return <a href={`#question-section-${q.displayIndex}`} title={labels[q.type]} className={`grid h-9 place-items-center rounded-md border text-xs font-bold ${done ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{q.displayIndex + i}</a>; }))}</div>
        <div className="mb-4 space-y-1 border-t pt-3 text-xs text-slate-500">{Object.entries(labels).filter(([k]) => indexed.some(q => q.type === k)).map(([k,v]) => <p><span className="font-bold text-slate-700">{indexed.filter(q => q.type === k).length}</span> {v}</p>)}</div>
        <button onClick={() => setConfirm(true)} disabled={submitting} className="w-full rounded-lg bg-[#075985] px-4 py-3 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60">{submitting ? 'Đang nộp bài…' : 'NỘP BÀI'}</button>
      </aside>
    </main>
    {confirm && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold">Xác nhận nộp bài?</h2><p className="mt-2 text-sm text-slate-600">Bạn đã hoàn thành {answered}/{totalItems} câu. Sau khi nộp sẽ không thể sửa đáp án.</p><div className="mt-5 flex justify-end gap-3"><button onClick={() => setConfirm(false)} className="rounded-lg border px-4 py-2 text-sm font-bold">Làm tiếp</button><button onClick={submit} className="rounded-lg bg-sky-800 px-4 py-2 text-sm font-bold text-white">Xác nhận nộp</button></div></div></div>}
  </div>;
}
