import { useState, useEffect, useRef } from 'react';
import { parseMarkdownWithMath, renderMathInContainer } from '../../lib/markdown';
import type { Question, Answer } from '../../types';

interface WorksheetGeneratorProps {
  exam: { id: string; slug: string; title: string };
  questions: (Question & { answers: Answer[] })[];
}

export default function WorksheetGenerator({ exam, questions }: WorksheetGeneratorProps) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [schoolName, setSchoolName] = useState('TRƯỜNG THPT ........................');
  const [className, setClassName] = useState('Lớp: ........................');
  const [teacherName, setTeacherName] = useState('Giáo viên: ........................');
  const [schoolYear, setSchoolYear] = useState('Năm học: 2023 - 2024');
  
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      renderMathInContainer(contentRef.current);
    }
  }, [questions, showAnswers]);

  const handlePrint = () => {
    window.print();
  };

  // Lọc các câu hỏi không có part cha (hoặc part cha là chính nó nếu database lưu khác)
  // Thực tế: trong DB hiện tại, các câu hỏi đọc hiểu/cloze có sub-questions trong metadata.
  
  const renderQuestion = (q: Question & { answers: Answer[] }, index: number) => {
    const isGroup = ['read', 'read_cloze', 'list'].includes(q.type || '');
    const subQuestions: any[] = (q.metadata as any)?.questions || [];
    const htmlContent = parseMarkdownWithMath(q.content || '', false);
    
    return (
      <div key={q.id} className="mb-6 break-inside-avoid">
        <div className="flex gap-2">
          <span className="font-bold whitespace-nowrap">Câu {index + 1}:</span>
          <div 
            className="flex-1 text-justify prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
        
        {/* Render sub questions for reading/cloze */}
        {isGroup && subQuestions.length > 0 && (
          <div className="mt-4 pl-8 space-y-4">
            {subQuestions.map((sq, sqIdx) => (
              <div key={sqIdx} className="break-inside-avoid">
                <div className="font-semibold mb-2">Ý {sqIdx + 1}: {sq.question}</div>
                {sq.options && sq.options.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {sq.options.map((opt: string, optIdx: number) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCorrect = showAnswers && String(sq.answer).toUpperCase() === letter;
                      return (
                        <div key={optIdx} className={`flex items-start gap-2 ${isCorrect ? 'font-bold text-red-600' : ''}`}>
                          <span className="font-bold">{letter}.</span>
                          <span dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(opt, true) }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Render options for normal questions */}
        {!isGroup && q.options && q.options.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pl-8">
            {q.answers.map((ans, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isCorrect = showAnswers && ans.is_correct;
              return (
                <div key={optIdx} className={`flex items-start gap-2 ${isCorrect ? 'font-bold text-red-600 underline' : ''}`}>
                  <span className="font-bold">{letter}.</span>
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdownWithMath(ans.content || '', true) }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 p-4 md:p-8 font-serif">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { 
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .page-break { page-break-before: always; }
          /* Ensure text is black for printing */
          * { color: black !important; }
          /* Except answers if we want to highlight them */
          .text-red-600 { color: #dc2626 !important; font-weight: bold !important; -webkit-print-color-adjust: exact; }
          .dark { background: white !important; color: black !important; }
        }
      `}</style>

      {/* Control Panel (No Print) */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Công cụ tạo phiếu bài tập</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Chỉnh sửa thông tin tiêu đề và xuất ra file PDF</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                showAnswers 
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                  : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-transparent'
              }`}
            >
              {showAnswers ? '👁️ Ẩn đáp án' : '👁️ Hiện đáp án'}
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-500/20 transition flex items-center gap-2"
            >
              🖨️ In / Xuất PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Tên trường</label>
            <input 
              type="text" 
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Năm học</label>
            <input 
              type="text" 
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Giáo viên</label>
            <input 
              type="text" 
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Lớp</label>
            <input 
              type="text" 
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* A4 Document Preview */}
      <div 
        ref={contentRef}
        className="print-container max-w-[210mm] mx-auto bg-white text-black shadow-xl rounded-sm p-[15mm] md:p-[20mm]"
        style={{ minHeight: '297mm' }}
      >
        {/* Document Header */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-6">
          <div className="text-center font-bold text-sm">
            <p>{schoolName}</p>
            <p className="mt-1">TỔ CHUYÊN MÔN</p>
            <p className="mt-1 font-normal italic">{schoolYear}</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg mb-1">PHIẾU BÀI TẬP / ĐỀ KIỂM TRA</p>
            <p className="font-bold uppercase text-sm mb-2">{exam.title}</p>
            <div className="text-sm italic">
              <span className="mr-6">{className}</span>
              <span>{teacherName}</span>
            </div>
          </div>
        </div>

        {/* Student Info Space */}
        <div className="flex justify-between items-center mb-8 text-sm italic">
          <p>Họ và tên học sinh: ..........................................................................</p>
          <p>Điểm: ....................</p>
        </div>

        {/* Note if answers are shown */}
        {showAnswers && (
          <div className="no-print bg-rose-100 text-rose-800 px-4 py-2 rounded mb-6 font-bold text-center">
            BẢN DÀNH CHO GIÁO VIÊN (CÓ ĐÁP ÁN)
          </div>
        )}

        {/* Questions List */}
        <div className="text-sm leading-relaxed">
          {questions.map((q, idx) => renderQuestion(q, idx))}
        </div>
        
        {/* Footer */}
        <div className="mt-12 text-center text-sm italic">
          --- Hết ---
        </div>
      </div>
    </div>
  );
}
