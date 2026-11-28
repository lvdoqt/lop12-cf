import React, { useState, useEffect, useRef } from 'react';
import { withBase } from '../../lib/base';
import { PadletRichContent } from './padlet/PadletRichContent';

function hasRichSyntax(text: string): boolean {
  return /\$|\\\(|\\\[|!\[[^\]]*\]\([^)]+\)/.test(text);
}

export default function PollManager() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [poll, setPoll] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'question' | number>('question');

  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const optionInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh poll data
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (poll?.code && poll?.status === 'active') {
      const code = poll.code;
      interval = setInterval(async () => {
        try {
          const res = await fetch(withBase(`/api/giao-vien/polls/${code}`));
          if (res.ok) {
            const data = await res.json();
            setPoll(data);
          }
        } catch (err) {}
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [poll?.code, poll?.status]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const insertIntoQuestion = (snippet: string) => {
    const textarea = questionTextareaRef.current;
    if (!textarea) {
      setQuestion((prev) => (prev ? `${prev}\n${snippet}` : snippet));
      return;
    }
    const start = textarea.selectionStart ?? question.length;
    const end = textarea.selectionEnd ?? question.length;
    setQuestion((prev) => prev.slice(0, start) + snippet + prev.slice(end));
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + snippet.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const insertIntoOption = (index: number, snippet: string) => {
    const input = optionInputRefs.current[index];
    if (!input) {
      setOptions((prev) => prev.map((opt, i) => (i === index ? (opt ? `${opt} ${snippet}` : snippet) : opt)));
      return;
    }
    const start = input.selectionStart ?? options[index].length;
    const end = input.selectionEnd ?? options[index].length;
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? opt.slice(0, start) + snippet + opt.slice(end) : opt))
    );
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + snippet.length;
      input.setSelectionRange(pos, pos);
    });
  };

  const uploadAndInsertImage = async (file: File, target: 'question' | number) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chỉ chọn hoặc dán tệp hình ảnh (PNG, JPG, GIF, WebP).');
      return;
    }
    setUploadError(null);
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(withBase('/api/giao-vien/polls/upload'), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setUploadError(data?.error || 'Không thể tải ảnh lên.');
        return;
      }
      if (target === 'question') {
        insertIntoQuestion(`\n![Ảnh đính kèm](${data.url})\n`);
      } else {
        insertIntoOption(target, `![Ảnh](${data.url})`);
      }
    } catch (err) {
      console.error(err);
      setUploadError('Lỗi kết nối khi tải ảnh lên.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent, target: 'question' | number) => {
    const items = e.clipboardData?.items;
    if (!items || isUploadingImage) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          await uploadAndInsertImage(file, target);
          return;
        }
      }
    }
  };

  const triggerFilePicker = (target: 'question' | number) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      await uploadAndInsertImage(file, uploadTarget);
    }
  };

  const createPoll = async () => {
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) return alert('Nhập câu hỏi và ít nhất 2 lựa chọn');
    
    setIsCreating(true);
    try {
      const res = await fetch(withBase('/api/giao-vien/polls'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: validOptions })
      });
      if (res.ok) {
        const data = await res.json();
        setPoll(data);
      } else {
        alert('Có lỗi xảy ra');
      }
    } catch (err) {
      alert('Lỗi mạng');
    }
    setIsCreating(false);
  };

  const closePoll = async () => {
    if (!poll) return;
    try {
      await fetch(withBase(`/api/giao-vien/polls/${poll.code}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' })
      });
      setPoll({ ...poll, status: 'closed' });
    } catch (err) {}
  };

  if (!poll) {
    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tạo khảo sát nhanh</h2>
          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
            Hỗ trợ LaTeX (<code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-800">$x^2$</code>, <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-800">$$...$$</code>) &amp; dán ảnh (Ctrl+V)
          </span>
        </div>

        {uploadError && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center justify-between gap-2">
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError(null)} className="text-xs underline">Đóng</button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Câu hỏi</label>
              <button
                type="button"
                disabled={isUploadingImage}
                onClick={() => triggerFilePicker('question')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/40 transition disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {isUploadingImage ? 'Đang tải ảnh...' : 'Chèn ảnh'}
              </button>
            </div>
            <textarea
              ref={questionTextareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPaste={(e) => handlePaste(e, 'question')}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500 min-h-[110px]"
              placeholder="VD: Tìm giá trị lớn nhất của hàm số $y = x^3 - 3x + 2$ trên $[0; 2]$ (có thể Ctrl+V để dán ảnh trực tiếp)"
            />
            {question.trim() && hasRichSyntax(question) && (
              <div className="mt-2 p-3.5 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-dashed border-gray-300 dark:border-slate-700">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5">Xem trước câu hỏi</div>
                <PadletRichContent content={question} className="text-gray-900 dark:text-white text-base font-semibold" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Các lựa chọn</label>
            <div className="space-y-2.5">
              {options.map((opt, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex gap-2">
                    <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-pink-100 text-pink-700 font-bold dark:bg-pink-900/30 dark:text-pink-400 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      ref={(el) => { optionInputRefs.current[i] = el; }}
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      onPaste={(e) => handlePaste(e, i)}
                      className="flex-1 px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500"
                      placeholder={`Lựa chọn ${i + 1} (hỗ trợ $LaTeX$ hoặc dán ảnh Ctrl+V)`}
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => triggerFilePicker(i)}
                      title="Chèn ảnh cho lựa chọn này"
                      className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-xl transition disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  {opt.trim() && hasRichSyntax(opt) && (
                    <div className="ml-12 px-3 py-2 rounded-lg bg-gray-50/80 dark:bg-slate-800/60 border border-dashed border-gray-200 dark:border-slate-700">
                      <PadletRichContent content={opt} className="text-sm text-gray-800 dark:text-slate-200" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {options.length < 8 && (
              <button type="button" onClick={addOption} className="mt-3 text-sm font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center">
                + Thêm lựa chọn
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={createPoll}
            disabled={isCreating || isUploadingImage}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-lg shadow-lg shadow-pink-500/30 hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {isCreating ? 'Đang tạo...' : '🚀 Bắt đầu khảo sát'}
          </button>
        </div>
      </div>
    );
  }

  // Active Poll View
  const voteUrl = `${window.location.origin}${withBase(`/thi-online/poll/${poll.code}`)}`;
  const totalVotes = poll.options.reduce((sum: number, o: any) => sum + o.votes, 0);

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm font-sans flex flex-col items-center">
      
      {poll.status === 'active' && (
        <div className="animate-pulse flex items-center gap-2 px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-full font-bold text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span> Đang diễn ra
        </div>
      )}
      {poll.status === 'closed' && (
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400 rounded-full font-bold text-sm mb-6">
          Đã kết thúc
        </div>
      )}

      <div className="text-2xl md:text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-10 leading-snug max-w-3xl w-full [&_img]:mx-auto">
        <PadletRichContent content={poll.question} />
      </div>

      <div className="flex flex-col md:flex-row gap-12 w-full max-w-4xl">
        {/* Left: QR Code */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="p-4 bg-white rounded-2xl border-4 border-pink-500 shadow-xl mb-4">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(voteUrl)}`} 
              alt="QR Code" 
              className="w-48 h-48 md:w-56 md:h-56 object-contain"
            />
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Hoặc truy cập link:</p>
          <a href={voteUrl} target="_blank" rel="noreferrer" className="text-base md:text-lg font-black text-pink-600 dark:text-pink-400 hover:underline mt-1 bg-pink-50 dark:bg-pink-950/30 px-4 py-2 rounded-xl break-all text-center">
            {voteUrl.replace(/^https?:\/\//, '')}
          </a>
          <p className="mt-4 text-sm font-bold text-gray-800 dark:text-gray-200">
            Mã truy cập: <span className="text-xl text-rose-500 font-black tracking-widest">{poll.code}</span>
          </p>
        </div>

        {/* Right: Chart */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-gray-700 dark:text-slate-300">Kết quả trực tiếp</h3>
            <span className="text-sm font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              {totalVotes} lượt bình chọn
            </span>
          </div>
          
          <div className="space-y-4">
            {poll.options.map((opt: any, i: number) => {
              const letter = String.fromCharCode(65 + i);
              const percent = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
              return (
                <div key={opt.id}>
                  <div className="flex justify-between items-start gap-3 text-sm font-bold mb-1">
                    <div className="flex items-start gap-1.5 text-gray-800 dark:text-gray-200 min-w-0">
                      <span className="shrink-0">{letter}.</span>
                      <PadletRichContent content={opt.text} className="min-w-0 [&_img]:max-h-32" />
                    </div>
                    <span className="text-pink-600 dark:text-pink-400 shrink-0">{opt.votes} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-pink-500 to-rose-500 h-4 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {poll.status === 'active' && (
            <button
              type="button"
              onClick={closePoll}
              className="mt-8 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-slate-900 text-white font-bold transition w-full md:w-auto md:px-8 self-end shadow-md"
            >
              Kết thúc khảo sát
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
