import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
import type { Question, Answer } from '../types';

interface QuestionCardProps {
  question: Question & { answers: Answer[] };
  index: number;
  selectedAnswer?: string | string[] | Record<string, string>;
  onAnswer: (questionId: string, answer: any) => void;
  mode: 'take' | 'review';
  sectionKey?: 'mcq' | 'msq' | 'sa' | 'tl';
}

const SECTION_ACCENT: Record<string, {
  border: string; headBg: string; headText: string; numBg: string; numText: string; ring: string;
  selBorder: string; selBg: string; selText: string; selNumBg: string; selNumText: string; selRing: string;
}> = {
  mcq: {
    border: 'border-blue-200/60 dark:border-blue-900/40',
    headBg: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
    headText: 'text-blue-700 dark:text-blue-300',
    numBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    numText: 'text-white',
    ring: 'ring-blue-400/30',
    selBorder: 'border-blue-500',
    selBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    selText: 'text-blue-700 dark:text-blue-400',
    selNumBg: 'bg-blue-600',
    selNumText: 'text-white',
    selRing: 'ring-blue-400/40',
  },
  msq: {
    border: 'border-violet-200/60 dark:border-violet-900/40',
    headBg: 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30',
    headText: 'text-violet-700 dark:text-violet-300',
    numBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    numText: 'text-white',
    ring: 'ring-violet-400/30',
    selBorder: 'border-violet-500',
    selBg: 'bg-violet-50/60 dark:bg-violet-950/20',
    selText: 'text-violet-700 dark:text-violet-400',
    selNumBg: 'bg-violet-600',
    selNumText: 'text-white',
    selRing: 'ring-violet-400/40',
  },
  sa: {
    border: 'border-amber-200/60 dark:border-amber-900/40',
    headBg: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
    headText: 'text-amber-700 dark:text-amber-300',
    numBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    numText: 'text-white',
    ring: 'ring-amber-400/30',
    selBorder: 'border-amber-500',
    selBg: 'bg-amber-50/60 dark:bg-amber-950/20',
    selText: 'text-amber-700 dark:text-amber-400',
    selNumBg: 'bg-amber-600',
    selNumText: 'text-white',
    selRing: 'ring-amber-400/40',
  },
  tl: {
    border: 'border-emerald-200/60 dark:border-emerald-900/40',
    headBg: 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
    headText: 'text-emerald-700 dark:text-emerald-300',
    numBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    numText: 'text-white',
    ring: 'ring-emerald-400/30',
    selBorder: 'border-emerald-500',
    selBg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    selText: 'text-emerald-700 dark:text-emerald-400',
    selNumBg: 'bg-emerald-600',
    selNumText: 'text-white',
    selRing: 'ring-emerald-400/40',
  },
};

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

const parseMarkdownWithMath = (text: string = '', isInline = false) => {
  if (!text) return '';
  const mathBlocks: string[] = [];
  let index = 0;
  const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]*?\$)/g;
  
  const textWithoutMath = text.replace(mathRegex, (match) => {
    mathBlocks.push(match);
    return `@@MATH_BLOCK_${index++}@@`;
  });

  let html = (isInline ? marked.parseInline(textWithoutMath) : marked.parse(textWithoutMath)) as string;

  mathBlocks.forEach((block, i) => {
    html = html.replace(`@@MATH_BLOCK_${i}@@`, block);
  });

  return html;
};

export default function QuestionCard({ question, index, selectedAnswer, onAnswer, mode, sectionKey = 'mcq' }: QuestionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const accent = SECTION_ACCENT[sectionKey] || SECTION_ACCENT.mcq;

  const contentHtml = useMemo(() => ({ __html: parseMarkdownWithMath(question.content || '', false) }), [question.content]);
  const explanationHtml = useMemo(() => ({ __html: parseMarkdownWithMath(question.explanation || '', false) }), [question.explanation]);
  const answerHtmlMap = useMemo(() => {
    const map: Record<string, { __html: string }> = {};
    question.answers.forEach((a) => {
      map[a.id] = { __html: parseMarkdownWithMath(a.content || '', true) };
    });
    return map;
  }, [question.answers]);

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

  const getInitialSelection = () => {
    if (!selectedAnswer) return null;
    if (question.type === 'msq') return selectedAnswer as Record<string, string>;
    if (question.type === 'multiple_choice') return selectedAnswer as string[];
    if (question.type === 'sa' || question.type === 'tl') return selectedAnswer as string;
    return selectedAnswer as string;
  };

  const [selection, setSelection] = useState<any>(getInitialSelection());

  const handleSingleChoice = useCallback((answerId: string) => {
    setSelection(answerId);
    onAnswer(question.id, answerId);
  }, [question.id, onAnswer]);

  const handleMultipleChoice = useCallback((answerId: string) => {
    setSelection((prev: string[]) => {
      const arr = prev ? [...prev] : [];
      const idx = arr.indexOf(answerId);
      if (idx > -1) arr.splice(idx, 1);
      else arr.push(answerId);
      onAnswer(question.id, arr);
      return arr;
    });
  }, [question.id, onAnswer]);

  const handleMSQ = useCallback((answerId: string, choice: 'Đúng' | 'Sai') => {
    setSelection((prev: Record<string, string>) => {
      const next = { ...(prev || {}), [answerId]: choice };
      onAnswer(question.id, next);
      return next;
    });
  }, [question.id, onAnswer]);

  const handleTextInput = useCallback((value: string) => {
    setSelection(value);
    onAnswer(question.id, value);
  }, [question.id, onAnswer]);

  const isSelected = (answerId: string) => {
    if (question.type === 'multiple_choice') return Array.isArray(selection) && selection.includes(answerId);
    if (question.type === 'msq') return false;
    return selection === answerId;
  };

  const difficultyLabel = question.difficulty === 'easy' ? 'Dễ' : question.difficulty === 'medium' ? 'Trung bình' : 'Khó';
  const difficultyColor = question.difficulty === 'easy'
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
    : question.difficulty === 'medium'
      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400';

  const typeLabel: Record<string, string> = {
    single_choice: 'Trắc nghiệm đơn',
    multiple_choice: 'Nhiều lựa chọn',
    true_false: 'Đúng / Sai',
    msq: 'Đúng / Sai',
    sa: 'Trả lời ngắn',
    tl: 'Tự luận',
  };

  return (
    <div
      ref={cardRef}
      id={`question-section-${index}`}
      className={`bg-white dark:bg-slate-900 border ${accent.border} rounded-2xl shadow-sm mb-6 transition-all duration-200 overflow-hidden`}
    >
      <div className={`flex items-center justify-between px-5 py-3 ${accent.headBg}`}>
        <span className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-extrabold ${accent.numBg} ${accent.numText} shadow-md`}>
          <span className="text-base md:text-lg leading-none">Câu {index}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${accent.headText}`}>
            {typeLabel[question.type] || 'Trắc nghiệm'}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${difficultyColor}`}>
            {difficultyLabel}
          </span>
        </div>
      </div>

      <div className="p-6">
      <div 
        className="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100 mb-6 leading-relaxed whitespace-pre-wrap select-none question-text [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3 [&_p]:inline"
        dangerouslySetInnerHTML={contentHtml}
      />

      {/* Standard options: single_choice, multiple_choice, true_false */}
      {(question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'true_false') && (
        <div className="space-y-3">
          {question.answers.map((answer, optIdx) => {
            const letter = optionLetters[optIdx];
            const selected = isSelected(answer.id);
            const correct = answer.is_correct;

            let optStyle = 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/40 text-gray-700 dark:text-slate-300';
            let letterStyle = 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';

            if (mode === 'take') {
              if (selected) {
                optStyle = `${accent.selBorder} ${accent.selBg} dark:${accent.selBorder} ${accent.selText} ring-2 ${accent.selRing}`;
                letterStyle = `${accent.selNumBg} border-transparent ${accent.selNumText}`;
              }
              if (selected && question.type === 'single_choice') {
                optStyle = `${accent.selBorder} ${accent.selBg} ${accent.selText} ring-2 ${accent.selRing}`;
              }
            } else {
              if (correct) {
                optStyle = 'border-emerald-500 bg-emerald-50/60 dark:border-emerald-500/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400';
                letterStyle = 'bg-emerald-600 border-emerald-600 text-white';
              } else if (selected && !correct) {
                optStyle = 'border-rose-500 bg-rose-50/60 dark:border-rose-500/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400';
                letterStyle = 'bg-rose-600 border-rose-600 text-white';
              }
            }

            return (
              <div
                key={answer.id}
                data-question-id={question.id}
                data-answer-id={answer.id}
                onClick={() => {
                  if (mode !== 'take') return;
                  if (question.type === 'multiple_choice') handleMultipleChoice(answer.id);
                  else handleSingleChoice(answer.id);
                }}
                className={`flex items-center p-4 rounded-xl border-2 transition-all duration-150 select-none cursor-pointer ${optStyle}`}
              >
                <div className={`w-6 h-6 rounded-lg mr-3 flex items-center justify-center font-bold text-xs transition-colors border shrink-0 ${letterStyle}`}>
                  {letter}
                </div>
                <div className="text-sm md:text-base font-medium flex-1 [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1" dangerouslySetInnerHTML={answerHtmlMap[answer.id]} />
                {mode === 'review' && correct && (
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {mode === 'review' && selected && !correct && (
                  <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 00-1.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MSQ: Đúng/Sai */}
      {question.type === 'msq' && (
        <div className="space-y-4">
          {question.answers.map((answer, optIdx) => {
            const letter = optionLetters[optIdx];
            const sel = (selection as Record<string, string> || {})[answer.id];
            const correctChoice = answer.is_correct ? 'Đúng' : 'Sai';
            const isCorrect = sel === correctChoice;

            return (
              <div key={answer.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all gap-3 ${
                mode === 'review'
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/10'
                  : 'border-gray-200 dark:border-slate-800/80 bg-white dark:bg-slate-900'
              }`}>
                <div className="flex items-start flex-1 min-w-0">
                  <span className={`w-6 h-6 rounded-lg ${accent.numBg} ${accent.numText} flex items-center justify-center font-bold text-xs mr-3 shrink-0`}>
                    {letter}
                  </span>
                  <div className="text-sm md:text-base font-medium text-gray-700 dark:text-slate-300 leading-relaxed [&_img]:max-w-full [&_img]:rounded-md [&_img]:my-1" dangerouslySetInnerHTML={answerHtmlMap[answer.id]} />
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {mode === 'take' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMSQ(answer.id, 'Đúng')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          sel === 'Đúng'
                            ? `${accent.selNumBg} border-transparent text-white shadow-sm`
                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        Đúng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMSQ(answer.id, 'Sai')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          sel === 'Sai'
                            ? `${accent.selNumBg} border-transparent text-white shadow-sm`
                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        Sai
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="text-gray-400 dark:text-slate-500">Chọn:</span>
                      <span className={`px-2.5 py-1 rounded-lg border font-bold ${
                        sel === 'Đúng'
                          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-400'
                          : sel === 'Sai'
                            ? 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                            : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'
                      }`}>
                        {sel || '(Trống)'}
                      </span>
                      <span className="text-gray-400 dark:text-slate-500">Đ/a:</span>
                      <span className="px-2.5 py-1 rounded-lg border font-bold bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400">
                        {correctChoice}
                      </span>
                      {isCorrect ? (
                        <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 00-1.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Short Answer */}
      {question.type === 'sa' && (
        <div className="space-y-4">
          {mode === 'take' ? (
            <input
              type="text"
              value={(selection as string) || ''}
              onChange={(e) => handleTextInput(e.target.value)}
              placeholder="Nhập câu trả lời của bạn..."
              className={`w-full px-4 py-3 rounded-xl border ${accent.border} bg-transparent text-sm focus:${accent.selBorder} outline-none text-gray-800 dark:text-slate-100 transition-colors`}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">Bạn đã điền:</span>
                <div className={`px-4 py-2.5 rounded-xl border-2 font-bold text-sm flex items-center gap-2 ${
                  (() => {
                    const s = (selection as string) || '';
                    const c = question.answer || '';
                    const ns = s.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
                    const nc = c.trim().toLowerCase().replace(/\s+/g, ' ').replace(',', '.');
                    const ok = ns === nc || (!isNaN(Number(ns)) && !isNaN(Number(nc)) && Number(ns) === Number(nc));
                    return ok
                      ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400';
                  })()
                }`}>
                  {selection || '(Bỏ trống)'}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-gray-500 dark:text-slate-400">Đáp án chính xác:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">{question.answer}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Essay / Tự luận */}
      {question.type === 'tl' && (
        <div className="space-y-4">
          {mode === 'take' ? (
            <textarea
              value={(selection as string) || ''}
              onChange={(e) => handleTextInput(e.target.value)}
              placeholder="Nhập bài làm / lời giải của bạn vào đây..."
              className={`w-full px-4 py-3 rounded-xl border ${accent.border} bg-transparent text-sm focus:${accent.selBorder} outline-none text-gray-800 dark:text-slate-100 transition-colors min-h-[150px] resize-y`}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">Bài làm của bạn:</span>
                <div className="p-4 rounded-xl border bg-gray-50 dark:bg-slate-800/50 dark:border-slate-800 text-gray-800 dark:text-slate-200 whitespace-pre-wrap min-h-[100px]">
                  {selection || '(Bỏ trống)'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review: Show Explanation */}
      {mode === 'review' && question.explanation && (
        <div className="mt-6 p-4 rounded-xl bg-blue-50/40 border border-blue-100/30 dark:bg-slate-900/60 dark:border-slate-800/80">
          <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center mb-2">
            <svg className="w-4.5 h-4.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Lời giải chi tiết:
          </h4>
          <div 
            className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mx-auto [&_img]:my-3 [&_p]:inline"
            dangerouslySetInnerHTML={explanationHtml}
          />
        </div>
      )}
      </div>
    </div>
  );
}
