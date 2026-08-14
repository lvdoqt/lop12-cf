import { useState, useEffect } from 'react';
import PresentationView from './PresentationView';
import { withBase } from '../../lib/base';
import type { Question, Answer } from '../../types';

const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function parseJsonToQuestions(raw: string): { title: string, questions: (Question & { answers: Answer[] })[] } {
  let parsed = JSON.parse(raw);
  let parsedTitle = '';
  
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    parsedTitle = parsed.title || '';
    parsed = parsed.questions;
  }

  if (!Array.isArray(parsed)) throw new Error('JSON phải là một mảng ([...]) hoặc { "questions": [...] }');
  if (parsed.length === 0) throw new Error('Mảng JSON không có câu hỏi nào');

  const questions = parsed.map((q: any, idx: number) => {
    const content = q.content || q.question;
    if (!content) throw new Error(`Câu ${idx + 1}: thiếu trường "content" hoặc "question"`);

    // Chuẩn hóa type: true_false_multi (AI 2025) → msq (PresentationView)
    let type = q.type || 'single_choice';
    let options: string[] = [];
    let answers: Answer[] = [];
    let answerStr = q.correct_option ?? q.answer ?? '';

    if (type === 'true_false_multi') {
      // Dạng Phần II — Đúng/Sai 4 ý (chuẩn THPT 2025)
      // Render bằng kiểu msq với mỗi answer là 1 ý (a/b/c/d)
      type = 'msq';
      const items: any[] = Array.isArray(q.items) ? q.items : [];
      answers = items.map((item: any, i: number) => ({
        id: `json-${idx}-${item.label || ALPHABET[i]}`,
        question_id: `json-${idx}`,
        content: `${item.label || ALPHABET[i].toLowerCase()}. ${item.statement || ''}`,
        is_correct: item.is_correct === true,
      }));
      options = items.map((item: any) => item.statement || '');
    } else {
      // Dạng thông thường: single_choice, sa, tl, read...
      if (Array.isArray(q.options)) {
        options = q.options;
      } else {
        ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].forEach(letter => {
          if (q[`option_${letter}`]) options.push(q[`option_${letter}`]);
        });
      }

      const correctLetters = answerStr
        .split(',')
        .map((l: string) => l.trim().toUpperCase())
        .filter(Boolean);

      answers = options.map((opt: string, i: number) => {
        const letter = ALPHABET[i] || String(i);
        return {
          id: `json-${idx}-${letter}`,
          question_id: `json-${idx}`,
          content: opt,
          is_correct: correctLetters.includes(letter),
        };
      });
    }

    const metadata: any = {
      type,
      difficulty: q.difficulty_level ?? q.metadata?.difficulty ?? q.difficulty ?? 'medium',
      explanation: q.explanation ?? q.metadata?.explanation ?? null,
      ...(q.metadata || {}),
    };

    if (q.metadata?.questions && Array.isArray(q.metadata.questions)) {
      metadata.questions = q.metadata.questions.map((subQ: any) => {
        let subOptions: string[] = [];
        if (Array.isArray(subQ.options)) {
          subOptions = subQ.options;
        } else {
          ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].forEach(letter => {
            if (subQ[`option_${letter}`]) subOptions.push(subQ[`option_${letter}`]);
          });
        }
        return { ...subQ, options: subOptions, answer: subQ.correct_option ?? subQ.answer ?? '' };
      });
    }

    return {
      id: `json-${idx}`,
      de_id: 'json',
      so_cau: idx + 1,
      phan: 'I',
      content,
      options,
      answer: answerStr,
      image_url: q.image_url ?? null,
      metadata,
      subject_id: '',
      explanation: metadata.explanation,
      difficulty: metadata.difficulty,
      type,
      category_id: null,
      answers,
    } as Question & { answers: Answer[] };
  });


  return { title: parsedTitle, questions };
}

export default function JsonPresentationLoader() {
  const [screen, setScreen] = useState<'input' | 'presenting'>('input');
  const [title, setTitle] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<(Question & { answers: Answer[] })[]>([]);
  const [showExample, setShowExample] = useState(false);

  // Auto-load from AI exam generator if arriving with ?from=ai
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') !== 'ai') return;
    const stored = sessionStorage.getItem('ai_exam_json');
    if (!stored) return;
    sessionStorage.removeItem('ai_exam_json');
    try {
      const parsed = parseJsonToQuestions(stored);
      setQuestions(parsed.questions);
      setTitle(parsed.title || 'Đề thi AI');
      setScreen('presenting');
    } catch {
      // ignore, show normal input screen
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStart() {
    setError('');
    const raw = jsonText.trim();
    if (!raw) {
      setError('Vui lòng nhập hoặc tải lên JSON câu hỏi.');
      return;
    }
    try {
      const parsedData = parseJsonToQuestions(raw);
      setQuestions(parsedData.questions);
      if (parsedData.title && !title) {
        setTitle(parsedData.title);
      }
      setScreen('presenting');
    } catch (err: any) {
      setError(`Lỗi JSON: ${err.message}`);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText((ev.target?.result as string) ?? '');
      setError('');
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  if (screen === 'presenting') {
    return (
      <PresentationView
        exam={{ id: 'json', slug: 'json', title: title || 'Trình chiếu từ JSON' }}
        questions={questions}
      />
    );
  }


  const placeholderJson = `{
  "title": "Tên bài trình chiếu",
  "questions": [
    {
      "type": "single_choice",
      "question": "Nội dung câu hỏi",
      "option_a": "Đáp án A",
      "option_b": "Đáp án B",
      "option_c": "Đáp án C",
      "option_d": "Đáp án D",
      "correct_option": "A",
      "explanation": "Giải thích chi tiết",
      "difficulty_level": "medium"
    }
  ]
}`;

  const exampleJson = `{
  "title": "Bài tập Đạo hàm cơ bản",
  "questions": [
    {
      "type": "single_choice",
      "question": "Tìm đạo hàm của hàm số $f(x) = x^3 - 3x^2 + 2x - 1$",
      "option_a": "$f'(x) = 3x^2 - 6x + 2$",
      "option_b": "$f'(x) = x^3 - 3x^2 + 2$",
      "option_c": "$f'(x) = 3x^2 - 6x + 1$",
      "option_d": "$f'(x) = 3x^2 - 3x + 2$",
      "correct_option": "A",
      "explanation": "Áp dụng quy tắc đạo hàm: $(x^n)' = nx^{n-1}$. Ta có:\\n$f'(x) = 3x^2 - 6x + 2$",
      "difficulty_level": "easy"
    },
    {
      "type": "true_false",
      "question": "Đạo hàm của hằng số luôn bằng 0.",
      "correct_option": "A",
      "option_a": "Đúng",
      "option_b": "Sai",
      "difficulty_level": "easy"
    }
  ]
}`;


  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 1rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(124,58,237,0.25)',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32, color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Trình chiếu từ JSON</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            Dán JSON câu hỏi hoặc tải file lên — trình chiếu ngay mà không cần lưu vào hệ thống
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              Tiêu đề buổi trình chiếu
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đề kiểm tra 15 phút — Toán 12"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition"
            />
          </div>

          {/* JSON textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">
                JSON câu hỏi
              </label>
              <label className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Tải file lên
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <textarea
              rows={12}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              placeholder={placeholderJson}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-slate-200 font-mono placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition resize-y"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Example toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowExample(!showExample)}
              className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 14, height: 14, transition: 'transform 0.15s', transform: showExample ? 'rotate(90deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Xem ví dụ cấu trúc JSON hợp lệ
            </button>
            {showExample && (
              <div className="mt-3 rounded-xl bg-gray-900 dark:bg-slate-950 p-4 overflow-x-auto">
                <pre className="text-[11px] text-green-400 font-mono leading-relaxed">{exampleJson}</pre>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <a
              href={withBase('/giao-vien/trinh-chieu')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Quay lại
            </a>
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow shadow-violet-500/25 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Bắt đầu trình chiếu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
