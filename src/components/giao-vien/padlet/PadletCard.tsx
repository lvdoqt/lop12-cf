import React, { useState } from 'react';
import type { PadletNote, PadletColor } from '../../../services/mockPadletStore';
import { withBase } from '../../../lib/base';

interface PadletCardProps {
  note: PadletNote;
  boardCode: string;
  isTeacher?: boolean;
  currentUser?: string;
  allowLikes?: boolean;
  allowComments?: boolean;
  onRefresh: () => void;
}

const colorStyles: Record<PadletColor, { bg: string; border: string; text: string; badge: string }> = {
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/60',
    text: 'text-amber-950 dark:text-amber-100',
    badge: 'bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    border: 'border-pink-200 dark:border-pink-800/60',
    text: 'text-pink-950 dark:text-pink-100',
    badge: 'bg-pink-200/70 text-pink-900 dark:bg-pink-900/60 dark:text-pink-200'
  },
  blue: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800/60',
    text: 'text-sky-950 dark:text-sky-100',
    badge: 'bg-sky-200/70 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200'
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    text: 'text-emerald-950 dark:text-emerald-100',
    badge: 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800/60',
    text: 'text-purple-950 dark:text-purple-100',
    badge: 'bg-purple-200/70 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200'
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-800/60',
    text: 'text-orange-950 dark:text-orange-100',
    badge: 'bg-orange-200/70 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200'
  }
};

export const PadletCard: React.FC<PadletCardProps> = ({
  note,
  boardCode,
  isTeacher = false,
  currentUser = '',
  allowLikes = true,
  allowComments = true,
  onRefresh
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [authorName, setAuthorName] = useState(currentUser || '');
  const [isLiking, setIsLiking] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const style = colorStyles[note.color] || colorStyles.yellow;

  const handleLike = async () => {
    if (!allowLikes || isLiking) return;
    setIsLiking(true);
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${boardCode}/notes/${note.id}/react`), {
        method: 'POST'
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLiking(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${boardCode}/notes/${note.id}/comment`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim() || 'Học sinh',
          content: commentText.trim()
        })
      });
      if (res.ok) {
        setCommentText('');
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) return;
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${boardCode}/notes/${note.id}`), {
        method: 'DELETE'
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePin = async () => {
    try {
      const res = await fetch(withBase(`/api/giao-vien/padlet/${boardCode}/notes/${note.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !note.is_pinned })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const timeFormatted = new Date(note.created_at).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      className={`group relative rounded-2xl border ${style.bg} ${style.border} ${style.text} p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between`}
    >
      {/* Top row: Author & Actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {note.is_pinned && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm"
              title="Được ghim bởi giáo viên"
            >
              📌 Đã ghim
            </span>
          )}
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badge}`}>
            {note.author_name}
          </span>
          <span className="text-[11px] opacity-60 font-medium">{timeFormatted}</span>
        </div>

        {/* Action buttons (Teacher controls or Author) */}
        {isTeacher && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              onClick={handleTogglePin}
              title={note.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-xs transition"
            >
              {note.is_pinned ? '📍' : '📌'}
            </button>
            <button
              onClick={handleDelete}
              title="Xóa ghi chú này"
              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs transition"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Note Title & Content */}
      <div className="space-y-1.5 flex-1">
        {note.title && (
          <h4 className="font-extrabold text-base leading-snug tracking-tight">
            {note.title}
          </h4>
        )}
        <p className="text-sm whitespace-pre-line leading-relaxed break-words font-medium opacity-90">
          {note.content}
        </p>
      </div>

      {/* Bottom Bar: Like & Comment toggles */}
      <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {allowLikes && (
            <button
              onClick={handleLike}
              disabled={isLiking}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-white/70 dark:bg-black/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 shadow-sm border border-black/5 dark:border-white/10 active:scale-95 transition"
            >
              <span>❤️</span>
              <span>{note.likes || 0}</span>
            </button>
          )}

          {allowComments && (
            <button
              onClick={() => setShowComments(!showComments)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-white/70 dark:bg-black/20 hover:bg-black/10 dark:hover:bg-white/10 shadow-sm border border-black/5 dark:border-white/10 transition"
            >
              <span>💬</span>
              <span>{note.comments?.length || 0}</span>
            </button>
          )}
        </div>

        {/* Small pin/author hint */}
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-40">
          {note.color}
        </span>
      </div>

      {/* Comments Drawer / Section */}
      {showComments && allowComments && (
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
          {/* List of comments */}
          {note.comments && note.comments.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {note.comments.map((cmt) => (
                <div
                  key={cmt.id}
                  className="bg-white/80 dark:bg-black/30 rounded-xl p-2 border border-black/5 dark:border-white/5"
                >
                  <div className="flex items-center justify-between font-bold text-[11px] mb-0.5">
                    <span>{cmt.author_name}</span>
                    <span className="opacity-50 text-[10px]">
                      {new Date(cmt.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="opacity-90">{cmt.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] italic opacity-60 text-center py-1">
              Chưa có bình luận nào. Hãy là người đầu tiên!
            </p>
          )}

          {/* Add comment input */}
          <form onSubmit={handleAddComment} className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Viết phản hồi..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !commentText.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              Gửi
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
