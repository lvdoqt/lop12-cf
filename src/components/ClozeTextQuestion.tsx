import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import type { Answer, Question } from '../types';

type Props = {
  question: Question & { answers: Answer[] };
  index: number;
  selected?: Record<string, string>;
  onAnswer?: (questionId: string, subIndex: number, value: string) => void;
  mode?: 'take' | 'review';
};

export default function ClozeTextQuestion({ question, index, selected = {}, onAnswer, mode = 'take' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const blanks: any[] = (question.metadata as any)?.questions || [];
  const content = useMemo(() => marked.parse(question.content || '') as string, [question.content]);
  useEffect(() => { (window as any).renderMathInElement?.(root.current, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false }); }, [content]);
  return <section ref={root} id={`question-section-${index}`} className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
    <header className="flex items-center justify-between bg-amber-50 px-5 py-3"><b className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white">Câu {index}{blanks.length > 1 ? ` – ${index + blanks.length - 1}` : ''}</b><span className="text-xs font-bold uppercase tracking-wider text-amber-800">Điền một từ</span></header>
    <div className="space-y-5 p-5 md:p-6">
      <div className="prose prose-sm max-w-none leading-7 text-slate-800" dangerouslySetInnerHTML={{ __html: content }} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blanks.map((blank: any, i: number) => <label className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm" key={i}>
          <span className="mb-2 block font-bold text-amber-800">Ô ({blank.number || index + i})</span>
          <input disabled={mode === 'review'} value={selected[String(i)] || ''} onChange={e => onAnswer?.(question.id, i, e.target.value)} placeholder="Nhập một từ" autoComplete="off" className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-100" />
          {mode === 'review' && <small className="mt-2 block font-bold text-emerald-700">Đáp án: {blank.correct_answer}</small>}
        </label>)}
      </div>
    </div>
  </section>;
}
