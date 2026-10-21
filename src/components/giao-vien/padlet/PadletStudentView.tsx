import React, { useState, useEffect } from 'react';
import type { PadletBoard, PadletColor, PadletTheme } from '../../../services/mockPadletStore';
import { PadletCard } from './PadletCard';
import { withBase } from '../../../lib/base';

interface PadletStudentViewProps {
  board: PadletBoard;
}

const themeStyles: Record<PadletTheme, { container: string; header: string; title: string }> = {
  corkboard: {
    container: 'bg-[#f4ebe1] dark:bg-stone-900 text-stone-900 dark:text-stone-100',
    header: 'bg-white/80 dark:bg-stone-950/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800',
    title: 'text-stone-900 dark:text-white'
  },
  chalkboard: {
    container: 'bg-[#1b382b] text-emerald-100',
    header: 'bg-[#142d22]/90 backdrop-blur-md border-b border-emerald-800/60',
    title: 'text-emerald-50'
  },
  gradient: {
    container: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100',
    header: 'bg-slate-900/80 backdrop-blur-md border-b border-indigo-900/50',
    title: 'text-white'
  },
  dark: {
    container: 'bg-slate-950 text-slate-100',
    header: 'bg-slate-900/80 backdrop-blur-md border-b border-slate-800',
    title: 'text-white'
  },
  lavender: {
    container: 'bg-[#f5f3ff] dark:bg-slate-950 text-slate-900 dark:text-slate-100',
    header: 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-purple-200/60 dark:border-slate-800',
    title: 'text-purple-950 dark:text-white'
  },
  minimal: {
    container: 'bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100',
    header: 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800',
    title: 'text-gray-900 dark:text-white'
  }
};

export const PadletStudentView: React.FC<PadletStudentViewProps> = ({ board: initialBoard }) => {
  const [board, setBoard] = useState<PadletBoard>(initialBoard);
  const [showModal, setShowModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | undefined>(undefined);

  // Form State
  const [authorName, setAuthorName] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState<PadletColor>('yellow');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load saved name from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('padlet_author_name');
      if (saved) setAuthorName(saved);
    } catch (e) {}
  }, []);

  // Auto-refresh poll every 2.5s
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch(withBase(`/api/giao-vien/padlet/${board.code}`));
        if (res.ok) {
          const data = await res.json();
          setBoard(data);
        }
      } catch (err) {}
    };

    const timer = setInterval(fetchLatest, 2500);
    return () => clearInterval(timer);
  }, [board.code]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim()) {
      alert('Vui lòng nhập họ và tên của bạn');
      return;
    }
    if (!noteContent.trim()) return;

    setIsSubmitting(true);
    try {
      // Save name to localStorage
      if (authorName.trim()) {
        try {
          localStorage.setItem('padlet_author_name', authorName.trim());
        } catch (e) {}
      }

      const res = await fetch(withBase(`/api/giao-vien/padlet/${board.code}/notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim() || 'Học sinh',
          title: noteTitle.trim() || undefined,
          content: noteContent.trim(),
          color: noteColor,
          column_id: selectedColumn || board.columns?.[0]?.id
        })
      });

      if (res.ok) {
        setNoteTitle('');
        setNoteContent('');
        setShowModal(false);
        // Refresh
        const latest = await (await fetch(withBase(`/api/giao-vien/padlet/${board.code}`))).json();
        setBoard(latest);
      } else {
        alert('Không thể đăng bài (bảng có thể đang bị khóa)');
      }
    } catch (err) {
      alert('Có lỗi mạng xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTheme = themeStyles[board.theme] || themeStyles.corkboard;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 pb-20 ${currentTheme.container}`}>
      {/* Student View Header */}
      <header className={`sticky top-0 z-30 px-4 py-3 shadow-sm ${currentTheme.header}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                P
              </span>
              <h1 className={`text-base sm:text-lg font-black tracking-tight ${currentTheme.title}`}>
                {board.title}
              </h1>
            </div>
            {board.description && (
              <p className="text-xs opacity-75 mt-0.5 line-clamp-1">{board.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {authorName && (
              <button
                type="button"
                onClick={() => {
                  const newName = prompt('Nhập lại họ tên của bạn:', authorName);
                  if (newName && newName.trim()) {
                    setAuthorName(newName.trim());
                    try {
                      localStorage.setItem('padlet_author_name', newName.trim());
                    } catch (e) {}
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition"
                title="Bấm để đổi tên của bạn"
              >
                <span>👤</span>
                <span className="truncate max-w-[130px]">{authorName}</span>
                <span className="text-[10px] opacity-50">✏️</span>
              </button>
            )}

            <span className="px-2.5 py-1 rounded-xl text-xs font-black tracking-wider bg-black/10 dark:bg-white/10">
              #{board.code}
            </span>
            {board.is_locked ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                🔒 Đã khóa
              </span>
            ) : (
              <button
                onClick={() => {
                  setSelectedColumn(undefined);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition active:scale-95"
              >
                <span>➕</span>
                <span className="hidden sm:inline">Dán ghi chú</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Board Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        {board.notes.length === 0 ? (
          <div className="py-20 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center text-3xl">
              ✍️
            </div>
            <h2 className="text-base font-bold mb-1">Chưa có ai dán ghi chú</h2>
            <p className="text-xs opacity-70 mb-5">
              Hãy là người đầu tiên chia sẻ câu hỏi hoặc ý kiến của bạn lên bảng nhé!
            </p>
            {!board.is_locked && (
              <button
                onClick={() => setShowModal(true)}
                className="px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-orange-700 transition"
              >
                ➕ Dán ghi chú ngay
              </button>
            )}
          </div>
        ) : board.layout_mode === 'columns' && board.columns && board.columns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {board.columns.map((col) => {
              const colNotes = board.notes.filter(
                (n) => n.column_id === col.id || (!n.column_id && col.id === board.columns![0].id)
              );
              return (
                <div
                  key={col.id}
                  className="bg-white/50 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                    <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                      <span>📌</span>
                      <span>{col.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-bold">
                        {colNotes.length}
                      </span>
                    </h3>
                    {!board.is_locked && (
                      <button
                        onClick={() => {
                          setSelectedColumn(col.id);
                          setShowModal(true);
                        }}
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition"
                        title="Dán ghi chú vào cột này"
                      >
                        ➕
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {colNotes.map((note) => (
                      <PadletCard
                        key={note.id}
                        note={note}
                        boardCode={board.code}
                        currentUser={authorName}
                        allowLikes={board.allow_likes}
                        allowComments={board.allow_comments}
                        onRefresh={() => {
                          fetch(withBase(`/api/giao-vien/padlet/${board.code}`))
                            .then((r) => r.json())
                            .then((d) => setBoard(d));
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {board.notes.map((note) => (
              <PadletCard
                key={note.id}
                note={note}
                boardCode={board.code}
                currentUser={authorName}
                allowLikes={board.allow_likes}
                allowComments={board.allow_comments}
                onRefresh={() => {
                  fetch(withBase(`/api/giao-vien/padlet/${board.code}`))
                    .then((r) => r.json())
                    .then((d) => setBoard(d));
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) for quick note creation on mobile */}
      {!board.is_locked && (
        <button
          onClick={() => {
            setSelectedColumn(undefined);
            setShowModal(true);
          }}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-rose-600 text-white flex items-center justify-center text-2xl shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition"
          title="Dán ghi chú"
        >
          ➕
        </button>
      )}

      {/* New Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
            >
              ✕
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>✍️</span> Dán ghi chú của bạn
            </h3>

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Họ và tên của bạn <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="VD: Lê Minh Thảo (Tổ 2)"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {board.layout_mode === 'columns' && board.columns && board.columns.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Chọn cột
                  </label>
                  <select
                    value={selectedColumn || board.columns[0].id}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {board.columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Tiêu đề (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="VD: Ý kiến của em"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Nội dung ghi chú <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nhập nội dung ý kiến, câu trả lời hoặc thảo luận..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                ></textarea>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  Màu sắc giấy note
                </label>
                <div className="flex gap-2">
                  {(['yellow', 'pink', 'blue', 'green', 'purple', 'orange'] as PadletColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNoteColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        noteColor === c ? 'scale-110 border-black dark:border-white shadow-md' : 'border-transparent'
                      }`}
                      style={{
                        backgroundColor:
                          c === 'yellow'
                            ? '#fef08a'
                            : c === 'pink'
                            ? '#fbcfe8'
                            : c === 'blue'
                            ? '#bae6fd'
                            : c === 'green'
                            ? '#bbf7d0'
                            : c === 'purple'
                            ? '#e9d5ff'
                            : '#fed7aa'
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !noteContent.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-xl shadow transition"
                >
                  {isSubmitting ? 'Đang dán...' : 'Dán ghi chú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
