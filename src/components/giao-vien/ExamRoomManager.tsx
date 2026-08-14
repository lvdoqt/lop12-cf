import { useState, useEffect, useCallback, useRef } from 'react';
import type { Exam } from '../../types';

interface ExamRoom {
  id: string;
  code: string;
  exam_title?: string;
  exam_duration?: number;
  status: 'waiting' | 'active' | 'closed';
  created_at: string;
  closed_at: string | null;
}

interface Participant {
  id: string;
  display_name: string;
  joined_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number;
  answered_count: number;
}

interface Props {
  exams: { id: string; title: string; duration: number; subject?: { name: string } }[];
  teacherRooms: ExamRoom[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: ExamRoom['status'] }) {
  const map = {
    waiting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    closed: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
  };
  const label = { waiting: 'Chờ vào', active: 'Đang thi', closed: 'Đã đóng' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${map[status]}`}>
      {status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />}
      {label[status]}
    </span>
  );
}

export default function ExamRoomManager({ exams, teacherRooms: initialRooms }: Props) {
  const [rooms, setRooms] = useState<ExamRoom[]>(initialRooms);
  const [activeRoom, setActiveRoom] = useState<ExamRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll participants when watching a room
  const pollParticipants = useCallback(async (room: ExamRoom) => {
    try {
      const res = await fetch(`/api/rooms/${room.code}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
        // Update room status in case teacher changed it elsewhere
        if (data.room) {
          setActiveRoom(prev => prev ? { ...prev, status: data.room.status } : prev);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (activeRoom && activeRoom.status !== 'closed') {
      pollParticipants(activeRoom);
      pollRef.current = setInterval(() => pollParticipants(activeRoom), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRoom?.id, activeRoom?.status]);

  async function createRoom() {
    if (!selectedExamId) { setError('Vui lòng chọn đề thi'); return; }
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/giao-vien/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedExamId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Lỗi tạo phòng'); return; }
      setRooms(prev => [data.room, ...prev]);
      setActiveRoom(data.room);
      setParticipants([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function activateRoom(room: ExamRoom) {
    const res = await fetch('/api/giao-vien/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: room.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveRoom(data.room);
      setRooms(prev => prev.map(r => r.id === data.room.id ? data.room : r));
    }
  }

  async function closeRoom(room: ExamRoom) {
    if (!confirm('Đóng phòng thi? Học sinh đang làm bài sẽ không thể tiếp tục.')) return;
    const res = await fetch(`/api/giao-vien/rooms?id=${room.id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setActiveRoom(data.room);
      setRooms(prev => prev.map(r => r.id === data.room.id ? data.room : r));
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink(code: string) {
    const link = `${window.location.origin}/thi-online?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const submitted = participants.filter(p => p.submitted_at).length;
  const inProgress = participants.filter(p => !p.submitted_at).length;
  const avgScore = participants.filter(p => p.score !== null).length > 0
    ? (participants.filter(p => p.score !== null).reduce((sum, p) => sum + p.score!, 0) / participants.filter(p => p.score !== null).length).toFixed(2)
    : null;

  // ── Panel: watch active room ─────────────────────────────────────────────
  if (activeRoom) {
    return (
      <div className="space-y-5">
        {/* Room header */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <StatusBadge status={activeRoom.status} />
                <button
                  onClick={() => { setActiveRoom(null); setParticipants([]); }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
                >
                  ← Quay lại
                </button>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeRoom.exam_title || 'Phòng thi'}</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Thời gian: {activeRoom.exam_duration ?? 90} phút</p>
            </div>

            {/* Room code display */}
            <div className="flex flex-col items-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 min-w-[180px]">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1 uppercase tracking-wider">Mã phòng</p>
              <p className="text-4xl font-black tracking-[0.25em] text-emerald-600 dark:text-emerald-400 font-mono">{activeRoom.code}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => copyCode(activeRoom.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  {copied ? '✓ Đã sao' : 'Sao mã'}
                </button>
                <button
                  onClick={() => copyLink(activeRoom.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                >
                  Sao link
                </button>
              </div>
            </div>
          </div>

          {/* Student join URL hint */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl text-sm text-blue-700 dark:text-blue-400">
            <span className="font-semibold">Học sinh vào:</span>{' '}
            <code className="bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/thi-online</code>
            {' '}→ nhập mã <strong>{activeRoom.code}</strong>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {activeRoom.status === 'waiting' && (
              <button
                onClick={() => activateRoom(activeRoom)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Bắt đầu thi
              </button>
            )}
            {activeRoom.status !== 'closed' && (
              <button
                onClick={() => closeRoom(activeRoom)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 text-sm font-semibold rounded-xl transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Đóng phòng
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Đã tham gia', value: participants.length, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Đang làm', value: inProgress, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Đã nộp', value: submitted, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Điểm TB', value: avgScore ?? '—', color: 'text-violet-600 dark:text-violet-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Participant table */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white">Danh sách học sinh</h3>
            <span className="text-xs text-gray-400 dark:text-slate-500">Tự động cập nhật 4s</span>
          </div>
          {participants.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="font-medium">Chưa có học sinh tham gia</p>
              <p className="text-sm mt-1">Chia sẻ mã phòng <strong className="text-emerald-500">{activeRoom.code}</strong> để học sinh vào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-slate-400">#</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-slate-400">Học sinh</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-slate-400">Tiến độ</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-slate-400">Trạng thái</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-slate-400 text-right">Điểm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {participants.map((p, i) => {
                    const pct = p.total_questions > 0 ? Math.round((p.answered_count / p.total_questions) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 text-gray-400 dark:text-slate-500 font-mono text-xs">{i + 1}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {p.display_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{p.display_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${p.submitted_at ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-slate-400 tabular-nums w-16">
                              {p.answered_count}/{p.total_questions} câu
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {p.submitted_at ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              ✓ Đã nộp {formatTime(p.submitted_at)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                              Đang làm
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold tabular-nums">
                          {p.score !== null ? (
                            <span className="text-emerald-600 dark:text-emerald-400">{p.score.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Panel: create room / room list ───────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Create room card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tạo phòng thi mới
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedExamId}
            onChange={e => { setSelectedExamId(e.target.value); setError(''); }}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Chọn đề thi —</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.title} ({e.duration}p)</option>
            ))}
          </select>
          <button
            onClick={createRoom}
            disabled={creating || !selectedExamId}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition flex items-center gap-2 shrink-0"
          >
            {creating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
            Mở phòng
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {/* Recent rooms */}
      {rooms.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Phòng thi gần đây</h3>
          <div className="space-y-2">
            {rooms.slice(0, 10).map(room => (
              <div
                key={room.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                onClick={() => { if (room.status !== 'closed') { setActiveRoom(room); setParticipants([]); } }}
              >
                <div className="flex items-center gap-4">
                  <div className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 tracking-widest w-20 shrink-0">
                    {room.code}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{room.exam_title || 'Đề thi'}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatTime(room.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={room.status} />
                  {room.status !== 'closed' && (
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rooms.length === 0 && (
        <div className="py-12 text-center text-gray-400 dark:text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="font-medium text-base">Chưa có phòng thi nào</p>
          <p className="text-sm mt-1">Chọn một đề thi và nhấn <strong>Mở phòng</strong> để bắt đầu</p>
        </div>
      )}
    </div>
  );
}