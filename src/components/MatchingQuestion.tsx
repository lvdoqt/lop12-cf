import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import type { Answer, Question } from '../types';

type Props = {
  question: Question & { answers: Answer[] };
  index: number;
  selected?: Record<string, string>;
  onAnswer?: (questionId: string, subIndex: number, letter: string) => void;
  mode?: 'take' | 'review';
};

export default function MatchingQuestion({ question, index, selected = {}, onAnswer, mode = 'take' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const prompts = (question.metadata as any)?.questions || [];
  const options = (question.metadata as any)?.options || [];
  const content = useMemo(() => marked.parse(question.content || '') as string, [question.content]);

  useEffect(() => {
    (window as any).renderMathInElement?.(root.current, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
      throwOnError: false,
    });
  }, [content]);

  return <section ref={root} id={`question-section-${index}`} className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
    <header className="flex items-center justify-between bg-cyan-50 px-5 py-3">
      <strong className="rounded-lg bg-cyan-700 px-3 py-1.5 text-sm text-white">Câu {index}</strong>
      <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">Ghép cặp</span>
    </header>
    <div className="space-y-5 p-5 md:p-6">
      <div className="prose prose-sm max-w-none font-medium text-slate-800" dangerouslySetInnerHTML={{ __html: content }} />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-slate-500">Nội dung cần ghép</p>
          {prompts.map((item: any, i: number) => <div className="grid grid-cols-[2rem_1fr_5rem] items-center gap-2 rounded-xl border border-slate-200 p-3" key={i}>
            <b className="text-cyan-700">{i + 1}.</b>
            <span className="text-sm text-slate-700">{item.question || item.content}</span>
            <select disabled={mode === 'review'} aria-label={`Đáp án ý ${i + 1}`} value={selected[String(i)] || ''} onChange={e => onAnswer?.(question.id, i, e.target.value)} className="rounded-lg border border-cyan-300 bg-white px-2 py-2 text-sm font-bold text-cyan-800 outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-100">
              <option value="">—</option>
              {options.map((opt: any, oi: number) => <option value={opt.key || String.fromCharCode(65 + oi)} key={oi}>{opt.key || String.fromCharCode(65 + oi)}</option>)}
            </select>
            {mode === 'review' && <small className="col-span-3 text-right font-bold text-emerald-700">Đáp án: {item.correct_option}</small>}
          </div>)}
        </div>
        <div className="space-y-2 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Phương án trả lời</p>
          {options.map((opt: any, i: number) => <div className="flex gap-3 rounded-lg bg-white p-3 text-sm shadow-sm" key={i}>
            <b className="text-cyan-700">{opt.key || String.fromCharCode(65 + i)}.</b><span>{opt.content || opt.text}</span>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
