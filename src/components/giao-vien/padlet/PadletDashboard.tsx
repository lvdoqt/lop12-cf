import React, { useState, useEffect } from 'react';
import type { PadletBoard, PadletTheme, PadletLayoutMode } from '../../../services/mockPadletStore';
import { withBase } from '../../../lib/base';

export const PadletDashboard: React.FC = () => {
  const [boards, setBoards] = useState<PadletBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<PadletTheme>('corkboard');
  const [layoutMode, setLayoutMode] = useState<PadletLayoutMode>('columns');
  const [columnsInput, setColumnsInput] = useState('💡 Ý tưởng, ❓ Thắc mắc, 🌟 Đóng góp');
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBoards = async () => {
    try {
      const res = await fetch(withBase('/api/giao-vien/padlet'));
      if (res.ok) {
        const data = await res.json();
        setBoards(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const columns = layoutMode === 'columns'
        ? columnsInput.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      const res = await fetch(withBase('/api/giao-vien/padlet'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          theme,
          layout_mode: layoutMode,
          columns,
          allow_comments: allowComments,
          allow_likes: allowLikes
        })
      });

      if (res.ok) {
        const created = await res.json();
        setShowCreateModal(false);
        setTitle('');
        setDescription('');
        // Redirect to new board
        window.location.href = withBase(`/giao-vien/padlet/${created.code}`);
      } else {
        alert('Có lỗi xảy ra khi tạo bảng');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBoard = async (code: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bảng tương tác này?')) return;
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${code}`), {
        method: 'DELETE'
      });
      if (res.ok) {
        setBoards(boards.filter(b => b.code !== code));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}${withBase(`/padlet/${code}`)}`;
    navigator.clipboard?.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-orange-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold">
            <span>✨</span> Bảng ý kiến &amp; Thảo luận lớp học
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Bảng tương tác Padlet
          </h2>
          <p className="text-sm text-white/90 leading-relaxed font-medium">
            Tạo không gian thảo luận trực quan, thu thập ý kiến học sinh, chia sẻ bài tập và trả lời câu hỏi trực tiếp trong giờ học.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="shrink-0 px-6 py-3.5 rounded-2xl bg-white text-orange-600 hover:bg-orange-50 font-extrabold text-sm shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 self-start sm:self-auto"
        >
          <span className="text-lg">➕</span>
          <span>Tạo bảng mới</span>
        </button>
      </div>

      {/* Boards Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            Đang tải danh sách bảng...
          </p>
        </div>
      ) : boards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center text-3xl">
            📌
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Chưa có bảng tương tác nào
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Bấm "Tạo bảng mới" để thiết lập bức tường số đầu tiên cho lớp học của bạn.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            Tạo bảng ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {boards.map((b) => (
            <div
              key={b.id}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black tracking-wider bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40">
                    PIN: {b.code}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400">
                    {new Date(b.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <h3 className="font-extrabold text-lg text-gray-900 dark:text-white leading-snug line-clamp-1">
                  {b.title}
                </h3>
                {b.description && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {b.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                  <span className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center gap-1">
                    <span>📝</span> {b.notes?.length || 0} ghi chú
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 capitalize">
                    {b.layout_mode === 'columns' ? 'Phân theo cột' : 'Tường tự do'}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 capitalize">
                    {b.theme}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleCopyLink(b.code)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-bold text-gray-700 dark:text-slate-200 transition"
                  title="Sao chép đường link cho học sinh"
                >
                  {copiedCode === b.code ? '✓ Đã chép' : '🔗 Link HS'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteBoard(b.code)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs transition"
                    title="Xóa bảng này"
                  >
                    🗑️
                  </button>
                  <a
                    href={withBase(`/giao-vien/padlet/${b.code}`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1"
                  >
                    <span>Mở bảng</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tạo Bảng Mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
            >
              ✕
            </button>

            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <span>🚀</span> Tạo bảng tương tác mới
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">
              Thiết lập bức tường ý kiến để bắt đầu tương tác với học sinh.
            </p>

            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Tiêu đề bảng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Thu hoạch bài học: Khảo sát hàm số"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Mô tả / Hướng dẫn học sinh
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Mỗi bạn dán 1 câu hỏi hoặc phát hiện thú vị sau bài học..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {/* Layout Mode */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  Bố cục hiển thị
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('columns')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      layoutMode === 'columns'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Phân chia theo cột</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Phù hợp KWL, thảo luận nhóm theo chủ đề</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayoutMode('wall')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      layoutMode === 'wall'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs text-gray-900 dark:text-white">Tường tự do (Wall)</div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Dạng lưới thẻ ghim tự do, ngẫu hứng</div>
                  </button>
                </div>
              </div>

              {/* Columns Input if columns layout */}
              {layoutMode === 'columns' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Tên các cột (cách nhau bởi dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={columnsInput}
                    onChange={(e) => setColumnsInput(e.target.value)}
                    placeholder="VD: Cột 1, Cột 2, Cột 3"
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Theme Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  Chủ đề nền
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'corkboard', label: 'Bảng gỗ Cork' },
                    { id: 'chalkboard', label: 'Bảng phấn xanh' },
                    { id: 'gradient', label: 'Gradient vũ trụ' },
                    { id: 'lavender', label: 'Tím Pastel' },
                    { id: 'dark', label: 'Chế độ tối' },
                    { id: 'minimal', label: 'Tối giản trắng' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id as PadletTheme)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        theme === t.id
                          ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                          : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={allowLikes}
                    onChange={(e) => setAllowLikes(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Cho phép học sinh thả tim ❤️ bình chọn thẻ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={allowComments}
                    onChange={(e) => setAllowComments(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span>Cho phép học sinh bình luận 💬 thảo luận dưới thẻ</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-xl shadow transition"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo bảng & Bắt đầu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
