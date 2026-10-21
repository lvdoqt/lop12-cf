import React, { useState, useEffect, useRef } from 'react';
import type { PadletBoard as BoardType, PadletColor, PadletTheme } from '../../../services/mockPadletStore';
import { PadletCard } from './PadletCard';
import { withBase } from '../../../lib/base';

interface PadletBoardProps {
  board: BoardType;
  isTeacher?: boolean;
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

export const PadletBoard: React.FC<PadletBoardProps> = ({ board: initialBoard, isTeacher = false }) => {
  const [board, setBoard] = useState<BoardType>(initialBoard);
  const [showQR, setShowQR] = useState(false);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sortBy, setSortBy] = useState<'pinned' | 'newest' | 'likes'>('pinned');

  // New Note Form State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState(isTeacher ? 'Giáo viên' : '');
  const [noteColor, setNoteColor] = useState<PadletColor>('yellow');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-refresh poll every 2.5s
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch(withBase(`/api/giao-vien/padlet/${board.code}`));
        if (res.ok) {
          const data = await res.json();
          setBoard(data);
        }
      } catch (err) {
        console.error('Lỗi cập nhật bảng:', err);
      }
    };

    const timer = setInterval(fetchLatest, 2500);
    return () => clearInterval(timer);
  }, [board.code]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Lock / Unlock Board
  const toggleLockBoard = async () => {
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${board.code}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_locked: !board.is_locked })
      });
      if (res.ok) {
        const updated = await res.json();
        setBoard(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Change Theme
  const handleChangeTheme = async (theme: PadletTheme) => {
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${board.code}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      });
      if (res.ok) {
        const updated = await res.json();
        setBoard(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create Note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setIsSubmittingNote(true);
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${board.code}/notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: noteAuthor.trim() || 'Học sinh',
          title: noteTitle.trim() || undefined,
          content: noteContent.trim(),
          color: noteColor,
          column_id: selectedColumn || board.columns?.[0]?.id
        })
      });

      if (res.ok) {
        setNoteTitle('');
        setNoteContent('');
        setShowNewNoteModal(false);
        // Refresh board
        const latest = await (await fetch(withBase(`/api/giao-vien/padlet/${board.code}`))).json();
        setBoard(latest);
      } else {
        alert('Không thể đăng ghi chú (bảng có thể đang bị khóa)');
      }
    } catch (e) {
      console.error(e);
      alert('Có lỗi mạng xảy ra');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Join Link URL
  const studentJoinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${withBase(`/padlet/${board.code}`)}`
    : `/padlet/${board.code}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(studentJoinUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Sort notes
  const getSortedNotes = (notes: typeof board.notes) => {
    return [...notes].sort((a, b) => {
      if (sortBy === 'pinned') {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'likes') {
        return (b.likes || 0) - (a.likes || 0);
      }
      // newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const currentTheme = themeStyles[board.theme] || themeStyles.corkboard;

  return (
    <div
      ref={containerRef}
      className={`min-h-screen flex flex-col transition-colors duration-300 ${currentTheme.container}`}
    >
      {/* Top Header Bar */}
      <header className={`sticky top-0 z-30 px-4 sm:px-6 py-3.5 shadow-sm ${currentTheme.header}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Board Title & Meta */}
          <div className="flex items-center gap-3">
            <a
              href={withBase('/giao-vien/padlet')}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold transition flex items-center gap-1"
              title="Quay lại danh sách bảng"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Quay lại</span>
            </a>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-lg sm:text-xl font-extrabold tracking-tight ${currentTheme.title}`}>
                  {board.title}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider bg-indigo-600 text-white shadow-sm">
                  {board.code}
                </span>
                {board.is_locked ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    🔒 Đã khóa
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Đang mở
                  </span>
                )}
              </div>
              {board.description && (
                <p className="text-xs opacity-75 mt-0.5 truncate max-w-xl">
                  {board.description}
                </p>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
            {/* Share / QR button */}
            <button
              onClick={() => setShowQR(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>Mã QR &amp; PIN</span>
            </button>

            {/* Post note button */}
            {!board.is_locked && (
              <button
                onClick={() => {
                  setSelectedColumn(undefined);
                  setShowNewNoteModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition active:scale-95"
              >
                <span>➕ Dán ghi chú</span>
              </button>
            )}

            {/* Teacher controls */}
            {isTeacher && (
              <>
                <button
                  onClick={toggleLockBoard}
                  title={board.is_locked ? 'Mở lại cho học sinh đăng bài' : 'Khóa bảng lại'}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    board.is_locked
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white/70 dark:bg-black/30 hover:bg-black/10 text-gray-700 dark:text-gray-200 border-black/10 dark:border-white/10'
                  }`}
                >
                  {board.is_locked ? '🔓 Mở khóa' : '🔒 Khóa bảng'}
                </button>

                {/* Theme switch dropdown */}
                <select
                  value={board.theme}
                  onChange={(e) => handleChangeTheme(e.target.value as PadletTheme)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 focus:outline-none"
                  title="Đổi chủ đề nền"
                >
                  <option value="corkboard">Bảng ghim gỗ (Corkboard)</option>
                  <option value="chalkboard">Bảng phấn xanh (Chalkboard)</option>
                  <option value="gradient">Gradient hiện đại</option>
                  <option value="dark">Chế độ tối (Dark)</option>
                  <option value="lavender">Tím Pastel (Lavender)</option>
                  <option value="minimal">Tối giản (Minimal)</option>
                </select>
              </>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/70 dark:bg-black/30 border border-black/10 dark:border-white/10 focus:outline-none"
            >
              <option value="pinned">Ghim lên đầu</option>
              <option value="newest">Mới nhất</option>
              <option value="likes">Nhiều tim nhất</option>
            </select>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình trình chiếu'}
              className="p-1.5 rounded-xl bg-white/70 dark:bg-black/30 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition"
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Board Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {board.notes.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto">
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-3xl shadow-inner">
              📝
            </div>
            <h2 className="text-xl font-bold mb-2">Bảng hiện chưa có ghi chú nào</h2>
            <p className="text-sm opacity-70 mb-6">
              Chia sẻ mã PIN hoặc quét mã QR để học sinh gửi ý kiến, hoặc bạn có thể dán ghi chú đầu tiên ngay bây giờ!
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowQR(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700 transition"
              >
                Hiện mã QR cho lớp
              </button>
              <button
                onClick={() => setShowNewNoteModal(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700 transition"
              >
                + Dán ghi chú mẫu
              </button>
            </div>
          </div>
        ) : board.layout_mode === 'columns' && board.columns && board.columns.length > 0 ? (
          /* Columns Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {board.columns.map((col) => {
              const colNotes = getSortedNotes(
                board.notes.filter((n) => n.column_id === col.id || (!n.column_id && col.id === board.columns![0].id))
              );
              return (
                <div
                  key={col.id}
                  className="bg-white/50 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5 flex flex-col gap-3 min-h-[400px]"
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
                          setShowNewNoteModal(true);
                        }}
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition"
                        title="Thêm ghi chú vào cột này"
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
                        isTeacher={isTeacher}
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
          /* Wall / Masonry Grid Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
            {getSortedNotes(board.notes).map((note) => (
              <PadletCard
                key={note.id}
                note={note}
                boardCode={board.code}
                isTeacher={isTeacher}
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

      {/* QR Code & PIN Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
            >
              ✕
            </button>

            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 mb-2">
              Quét mã để tham gia
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
              {board.title}
            </h2>

            {/* Giant QR Code */}
            <div className="my-6 p-4 bg-white rounded-2xl shadow-inner inline-block border-2 border-dashed border-gray-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                  studentJoinUrl
                )}`}
                alt="QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 mx-auto block"
              />
            </div>

            {/* Giant Room PIN */}
            <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 mb-4">
              <p className="text-xs uppercase font-bold text-gray-500 dark:text-slate-400 tracking-wider mb-1">
                Mã bảng (PIN)
              </p>
              <div className="text-3xl sm:text-4xl font-black tracking-widest text-indigo-600 dark:text-indigo-400 select-all">
                {board.code}
              </div>
            </div>

            {/* Copy Link */}
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={studentJoinUrl}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 truncate"
              />
              <button
                onClick={copyLink}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition ${
                  copySuccess ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {copySuccess ? 'Đã sao chép!' : 'Sao chép link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Note Modal */}
      {showNewNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowNewNoteModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
            >
              ✕
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>✍️</span> Dán ghi chú mới
            </h3>

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Họ tên hoặc biệt danh
                </label>
                <input
                  type="text"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                  placeholder="VD: Nguyễn Văn A (Tổ 1)"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {board.layout_mode === 'columns' && board.columns && board.columns.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Chọn cột dán bài
                  </label>
                  <select
                    value={selectedColumn || board.columns[0].id}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  placeholder="VD: Giải pháp cho câu hỏi 3"
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  placeholder="Nhập ý kiến, câu hỏi, hoặc thảo luận của bạn tại đây..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                ></textarea>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  Màu giấy ghi chú
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
                  onClick={() => setShowNewNoteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote || !noteContent.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow transition"
                >
                  {isSubmittingNote ? 'Đang gửi...' : 'Dán ghi chú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
