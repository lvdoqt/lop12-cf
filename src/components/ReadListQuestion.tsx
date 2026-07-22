import { useState, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
import type { Question, Answer } from '../types';

interface ReadListQuestionProps {
  question: Question & { answers: Answer[] };
  index: number;
  mode: 'take' | 'review';
  selectedAnswers?: Record<string, string> | null;
  onAnswer?: (parentId: string, subIndex: number, letter: string) => void;
}

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

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

export default function ReadListQuestion({ question, index, mode, selectedAnswers, onAnswer }: ReadListQuestionProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const subQuestions: any[] = (question.metadata as any)?.questions || [];
  const audioUrl = (question.metadata as any)?.audio_url;
  const isList = question.type === 'list';
  const isClozeRaw = question.type === 'read_cloze';
  const hasPlaceholders = useMemo(() => {
    if (!isClozeRaw) return false;
    if (/\(\d+\)/.test(question.content || '')) return true;
    for (const sq of subQuestions) {
      if (/\(\d+\)/.test(sq.question || '')) return true;
    }
    return false;
  }, [isClozeRaw, question.content, subQuestions]);
  const isCloze = isClozeRaw && hasPlaceholders;
  const typeLabel = isList ? 'Kỹ năng nghe' : isCloze ? 'Điền vào chỗ trống' : 'Đọc hiểu';
  // Màu sắc theo loại: indigo (read), teal (read_cloze), cyan (list)
  const headerGradient = isList
    ? 'from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30'
    : isCloze
    ? 'from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30'
    : 'from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30';
  const badgeBg = isList
    ? 'from-cyan-500 to-blue-600'
    : isCloze
    ? 'from-teal-500 to-cyan-600'
    : 'from-indigo-500 to-purple-600';
  const labelColor = isList
    ? 'text-cyan-700 dark:text-cyan-300'
    : isCloze
    ? 'text-teal-700 dark:text-teal-300'
    : 'text-indigo-700 dark:text-indigo-300';
  const borderColor = isList
    ? 'border-cyan-200/60 dark:border-cyan-900/40'
    : isCloze
    ? 'border-teal-200/60 dark:border-teal-900/40'
    : 'border-indigo-200/60 dark:border-indigo-900/40';
  const subDivider = isList
    ? 'border-cyan-100/70 dark:border-cyan-900/20'
    : isCloze
    ? 'border-teal-100/70 dark:border-teal-900/20'
    : 'border-indigo-100/70 dark:border-indigo-900/20';
  const subNumColor = isList
    ? 'text-cyan-500 dark:text-cyan-400'
    : isCloze
    ? 'text-teal-500 dark:text-teal-400'
    : 'text-indigo-500 dark:text-indigo-400';
  const selectedStyle = isList
    ? 'border-cyan-500 bg-cyan-50/60 dark:border-cyan-500/50 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-400 ring-2 ring-cyan-400/40'
    : isCloze
    ? 'border-teal-500 bg-teal-50/60 dark:border-teal-500/50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 ring-2 ring-teal-400/40'
    : 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 ring-2 ring-indigo-400/40';
  const selectedLetterStyle = isList
    ? 'bg-cyan-600 border-transparent text-white'
    : isCloze
    ? 'bg-teal-600 border-transparent text-white'
    : 'bg-indigo-600 border-transparent text-white';

  const contentHtml = useMemo(() => {
    let content = question.content || '';
    if (isCloze && subQuestions.length > 0) {
      content = content.replace(/\((\d+)\)/g, (match, p1) => {
        const num = parseInt(p1, 10);
        if (num >= 1 && num <= subQuestions.length) {
          return `(${index + num - 1})`;
        }
        return match;
      });
    }
    return { __html: parseMarkdownWithMath(content, false) };
  }, [question.content, isCloze, subQuestions.length, index]);
  const [selection, setSelection] = useState<Record<string, string>>(
    selectedAnswers && typeof selectedAnswers === 'object' ? { ...selectedAnswers } : {}
  );

  useEffect(() => {
    setSelection(selectedAnswers && typeof selectedAnswers === 'object' ? { ...selectedAnswers } : {});
  }, [selectedAnswers]);

  useEffect(() => {
    if (cardRef.current && typeof window !== 'undefined' && (window as any).renderMathInElement) {
      (window as any).renderMathInElement(cardRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  }, [contentHtml]);

  const handleClick = (subIdx: number, letter: string) => {
    if (mode !== 'take') return;
    const next = { ...selection, [subIdx]: letter };
    setSelection(next);
    onAnswer?.(question.id, subIdx, letter);
  };

  return (
    <div
      ref={cardRef}
      id={`question-section-${index}`}
      className={`bg-white dark:bg-slate-900 border ${borderColor} rounded-2xl shadow-sm mb-6 overflow-hidden`}
    >
      <div className={`flex items-center justify-between px-5 py-3 bg-gradient-to-r ${headerGradient}`}>
        <span className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-extrabold bg-gradient-to-br ${badgeBg} text-white shadow-md`}>
          <span className="text-base md:text-lg leading-none">{isCloze ? 'Nhóm' : 'Câu'} {index}{subQuestions.length > 1 ? ` - ${index + subQuestions.length - 1}` : ''}</span>
        </span>
        {!isCloze && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${labelColor}`}>{typeLabel}</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        <div
          className="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap select-none question-text [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3 [&_p]:inline"
          dangerouslySetInnerHTML={contentHtml}
        />

        {audioUrl && (
          <audio controls preload="none" className="w-full h-9 mt-2">
            <source src={audioUrl} />
          </audio>
        )}

        <ol className="space-y-4 mt-3">
          {subQuestions.map((sq, i) => {
            const correctLetter = (sq.correct_option || '').toUpperCase();
            const sel = selection[String(i)];
            const subNum = i + 1;
            
            let displayQuestion = sq.question || '';
            if (isCloze) {
              displayQuestion = displayQuestion.replace(/\((\d+)\)/g, (match, p1) => {
                const num = parseInt(p1, 10);
                if (num >= 1 && num <= subQuestions.length) {
                  return `(${index + num - 1})`;
                }
                return match;
              });
            }

            return (
              <li key={i} className={`border-t ${subDivider} pt-3 first:border-t-0 first:pt-0`}>
                <p className="text-sm md:text-base font-semibold text-gray-800 dark:text-slate-100 mb-2 leading-relaxed whitespace-pre-wrap">
                  <span className={`${subNumColor} mr-1`}>Câu {index + i}.</span>
                  <span dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(displayQuestion, false) }} />
                </p>
                <div className="space-y-2">
                  {optionLetters.filter(l => sq['option_' + l.toLowerCase()]).map(l => {
                    const text = sq['option_' + l.toLowerCase()] || '';
                    const isCorrect = l === correctLetter;
                    const isSel = sel === l;

                    let optStyle = 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/40 text-gray-700 dark:text-slate-300';
                    let letterStyle = 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';

                    if (mode === 'review') {
                      if (isCorrect) {
                        optStyle = 'border-emerald-500 bg-emerald-50/60 dark:border-emerald-500/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400';
                        letterStyle = 'bg-emerald-600 border-emerald-600 text-white';
                      } else if (isSel && !isCorrect) {
                        optStyle = 'border-rose-500 bg-rose-50/60 dark:border-rose-500/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400';
                        letterStyle = 'bg-rose-600 border-rose-600 text-white';
                      }
                    } else if (isSel) {
                      optStyle = selectedStyle;
                      letterStyle = selectedLetterStyle;
                    }

                    return (
                      <div
                        key={l}
                        onClick={() => handleClick(i, l)}
                        className={`flex items-center p-3.5 rounded-xl border-2 transition-all duration-150 select-none ${mode === 'take' ? 'cursor-pointer' : ''} ${optStyle}`}
                      >
                        <div className={`w-6 h-6 rounded-lg mr-3 flex items-center justify-center font-bold text-xs transition-colors border shrink-0 ${letterStyle}`}>
                          {l}
                        </div>
                        <div className="text-sm md:text-base font-medium flex-1" dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(text || '', true) }} />
                        {mode === 'review' && isCorrect && (
                          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {mode === 'review' && isSel && !isCorrect && (
                          <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 00-1.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
                {mode === 'review' && sq.explanation && (
                  <div className="mt-2 p-3 rounded-xl bg-blue-50/40 border border-blue-100/30 dark:bg-slate-900/60 dark:border-slate-800/80">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">💡 Giải thích:</p>
                    <div
                      className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(sq.explanation || '', false) }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
