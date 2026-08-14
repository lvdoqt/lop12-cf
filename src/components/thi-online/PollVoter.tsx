import { useState } from 'react';

interface PollVoterProps {
  initialPoll: any;
}

export default function PollVoter({ initialPoll }: PollVoterProps) {
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!initialPoll || initialPoll.status !== 'active') {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl text-center border border-gray-100 dark:border-slate-800">
        <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Khảo sát đã kết thúc</h2>
        <p className="text-gray-500 dark:text-slate-400">Giáo viên đã đóng bình chọn hoặc mã khảo sát không tồn tại.</p>
      </div>
    );
  }

  const handleVote = async (optionId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${initialPoll.code}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId })
      });
      if (res.ok) {
        setVoted(true);
      } else {
        alert('Khảo sát đã đóng hoặc có lỗi xảy ra.');
      }
    } catch (err) {
      alert('Lỗi mạng. Vui lòng thử lại.');
    }
    setSubmitting(false);
  };

  if (voted) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl text-center border border-gray-100 dark:border-slate-800 animate-in zoom-in duration-300">
        <div className="w-24 h-24 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white mb-2">Đã bình chọn!</h2>
        <p className="text-gray-500 dark:text-slate-400">Cảm ơn bạn đã tham gia. Hãy nhìn lên bảng để xem kết quả trực tiếp.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-10 md:mt-20 p-6 md:p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-6 justify-center">
        <span className="w-3 h-3 rounded-full bg-pink-500 animate-ping absolute"></span>
        <span className="w-3 h-3 rounded-full bg-pink-500 relative"></span>
        <span className="text-sm font-bold text-pink-500 uppercase tracking-widest">Khảo sát trực tiếp</span>
      </div>
      
      <h2 className="text-xl md:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-8 leading-snug">
        {initialPoll.question}
      </h2>

      <div className="space-y-3">
        {initialPoll.options.map((opt: any, i: number) => {
          const letter = String.fromCharCode(65 + i);
          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={submitting}
              className="w-full text-left p-4 md:p-5 rounded-2xl border-2 border-gray-100 dark:border-slate-800 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 active:scale-[0.98] transition-all group flex items-center gap-4"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-100 dark:bg-slate-800 group-hover:bg-pink-500 group-hover:text-white flex items-center justify-center font-bold text-lg text-gray-500 transition-colors">
                {letter}
              </div>
              <span className="flex-1 font-bold text-gray-700 dark:text-gray-200 text-lg md:text-xl">
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
