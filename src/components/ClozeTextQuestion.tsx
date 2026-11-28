import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import type { Answer, Question } from '../types';

type Props = {
  question: Question & { answers: Answer[] };
  index: number;
  selected?: Record<string, string>;
  onAnswer?: (questionId: string, subIndex: number, value: string) => void;
  mode?: 'take' | 'review';
  pointPerBlank?: number;
};

const formatPts = (val: number) => String(Math.round(val * 100) / 100);

export default function ClozeTextQuestion({ question, index, selected = {}, onAnswer, mode = 'take', pointPerBlank }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const blanks: any[] = (question.metadata as any)?.questions || [];
  const content = useMemo(() => marked.parse(question.content || '') as string, [question.content]);
  useEffect(() => { (window as any).renderMathInElement?.(root.current, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false }); }, [content]);

  const blankResults = blanks.map((blank: any, i: number) => {
    const actual = String(selected[String(i)] || '').trim().toLowerCase();
    const accepted = (Array.isArray(blank.accepted_answers) ? blank.accepted_answers : [blank.correct_answer])
      .map((x: any) => String(x || '').trim().toLowerCase());
    return Boolean(actual && accepted.includes(actual));
  });
  const correctBlanks = blankResults.filter(Boolean).length;
  const maxScore = pointPerBlank !== undefined ? blanks.length * pointPerBlank : null;
  const earnedScore = pointPerBlank !== undefined ? correctBlanks * pointPerBlank : null;

  return <section ref={root} id={`question-section-${index}`} className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-5 py-3">
      <b className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-sm font-extrabold text-white shadow-sm">Câu {index}{blanks.length > 1 ? ` – ${index + blanks.length - 1}` : ''}</b>
      {mode === 'review' && earnedScore !== null && maxScore !== null ? (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold border font-mono ${
          earnedScore >= maxScore && maxScore > 0
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : earnedScore > 0
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {earnedScore > 0 ? `+${formatPts(earnedScore)}` : '0'} / {formatPts(maxScore)} điểm
        </span>
      ) : (
        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Điền một từ</span>
      )}
    </header>
    <div className="space-y-5 p-5 md:p-6">
      <div className="prose prose-sm max-w-none leading-7 text-slate-800" dangerouslySetInnerHTML={{ __html: content }} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blanks.map((blank: any, i: number) => {
          const isOk = blankResults[i];
          return <label className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm" key={i}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-extrabold text-blue-600">Câu {blank.number || index + i}</span>
              {mode === 'review' && pointPerBlank !== undefined && (
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {isOk ? `+${formatPts(pointPerBlank)}đ` : '0đ'}
                </span>
              )}
            </div>
            <input disabled={mode === 'review'} value={selected[String(i)] || ''} onChange={e => onAnswer?.(question.id, i, e.target.value)} placeholder="Nhập một từ" autoComplete="off" className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-100" />
            {mode === 'review' && <small className="mt-2 block font-bold text-emerald-700">Đáp án: {blank.correct_answer}</small>}
          </label>;
        })}
      </div>
    </div>
  </section>;
}
