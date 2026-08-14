import { useState, useEffect } from 'react';

export default function PollManager() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [poll, setPoll] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Auto-refresh poll data
  useEffect(() => {
    let interval: any;
    if (poll && poll.status === 'active') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/giao-vien/polls/${poll.code}`);
          if (res.ok) {
            const data = await res.json();
            setPoll(data);
          }
        } catch (err) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [poll]);

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

  const createPoll = async () => {
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) return alert('Nhập câu hỏi và ít nhất 2 lựa chọn');
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/giao-vien/polls', {
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
      await fetch(`/api/giao-vien/polls/${poll.code}`, {
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Tạo khảo sát nhanh</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Câu hỏi</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500 min-h-[100px]"
              placeholder="VD: Theo các em, vì sao..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Các lựa chọn</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-pink-100 text-pink-700 font-bold dark:bg-pink-900/30 dark:text-pink-400">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-pink-500"
                    placeholder={`Lựa chọn ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 8 && (
              <button onClick={addOption} className="mt-3 text-sm font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center">
                + Thêm lựa chọn
              </button>
            )}
          </div>
          <button
            onClick={createPoll}
            disabled={isCreating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-lg shadow-lg shadow-pink-500/30 hover:-translate-y-0.5 transition"
          >
            {isCreating ? 'Đang tạo...' : '🚀 Bắt đầu khảo sát'}
          </button>
        </div>
      </div>
    );
  }

  // Active Poll View
  const voteUrl = `${window.location.origin}/thi-online/poll/${poll.code}`;
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

      <h2 className="text-2xl md:text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-10 leading-snug max-w-3xl">
        {poll.question}
      </h2>

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
          <a href={voteUrl} target="_blank" rel="noreferrer" className="text-lg font-black text-pink-600 dark:text-pink-400 hover:underline mt-1 bg-pink-50 dark:bg-pink-950/30 px-4 py-2 rounded-xl">
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
                  <div className="flex justify-between text-sm font-bold mb-1">
                    <span className="text-gray-800 dark:text-gray-200">{letter}. {opt.text}</span>
                    <span className="text-pink-600 dark:text-pink-400">{opt.votes} ({percent}%)</span>
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
