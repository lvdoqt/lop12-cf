import { useMemo, useRef, useLayoutEffect, memo } from 'react';
import { marked } from 'marked';
import type { Answer, Question } from '../types';

const parseMarkdownWithMath = (text: string = '', isInline = false) => {
  if (!text) return '';
  const mathBlocks: string[] = [];
  let mIndex = 0;
  const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]*?\$)/g;

  const textWithoutMath = text.replace(mathRegex, (match) => {
    mathBlocks.push(match);
    return `@@MATH_BLOCK_${mIndex++}@@`;
  });

  let html = (isInline ? marked.parseInline(textWithoutMath) : marked.parse(textWithoutMath)) as string;

  mathBlocks.forEach((block, i) => {
    html = html.replace(`@@MATH_BLOCK_${i}@@`, block);
  });

  return html;
};

const MathContent = memo(function MathContent({ text, inline = false, as = 'div', className }: {
  text: string;
  inline?: boolean;
  as?: 'div' | 'span';
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement & HTMLSpanElement>(null);
  const html = useMemo(() => ({ __html: parseMarkdownWithMath(text, inline) }), [text, inline]);

  useLayoutEffect(() => {
    let retryTimer: number | undefined;
    let attempts = 0;
    const renderMath = () => {
      if (!rootRef.current) return;
      const autoRender = (window as any).renderMathInElement;
      if (typeof autoRender !== 'function') {
        if (attempts++ < 20) retryTimer = window.setTimeout(renderMath, 150);
        return;
      }
      autoRender(rootRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    };
    renderMath();
    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [html, as]);

  const Tag = as;
  return <Tag ref={rootRef} className={className} dangerouslySetInnerHTML={html} />;
});

type Props = {
  question: Question & { answers: Answer[] };
  index: number;
  selected?: Record<string, string>;
  onAnswer?: (questionId: string, subIndex: number, letter: string) => void;
  mode?: 'take' | 'review';
};

export default function MatchingQuestion({ question, index, selected = {}, onAnswer, mode = 'take' }: Props) {
  const prompts = (question.metadata as any)?.questions || [];
  const options = (question.metadata as any)?.options || [];

  return <section id={`question-section-${index}`} className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
    <header className="flex items-center justify-between bg-cyan-50 px-5 py-3">
      <strong className="rounded-lg bg-cyan-700 px-3 py-1.5 text-sm text-white">Câu {index}</strong>
      <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">Ghép cặp</span>
    </header>
    <div className="space-y-5 p-5 md:p-6">
      <MathContent className="prose prose-sm max-w-none font-medium text-slate-800" text={question.content || ''} />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-slate-500">Nội dung cần ghép</p>
          {prompts.map((item: any, i: number) => <div className="grid grid-cols-[2rem_1fr_5rem] items-center gap-2 rounded-xl border border-slate-200 p-3" key={i}>
            <b className="text-cyan-700">{i + 1}.</b>
            <MathContent as="span" inline className="text-sm text-slate-700" text={item.question || item.content} />
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
            <b className="text-cyan-700">{opt.key || String.fromCharCode(65 + i)}.</b>
            <MathContent as="span" inline className="" text={opt.content || opt.text} />
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
