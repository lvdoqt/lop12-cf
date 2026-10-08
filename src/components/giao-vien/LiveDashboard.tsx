import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ExamRoom, RoomParticipant } from '../../types';
import { supabase } from '../../lib/supabase';
import { withBase } from '../../lib/base';

interface Props {
  roomId: string;
  initialRoom: ExamRoom;
  initialParticipants: RoomParticipant[];
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

export default function LiveDashboard({ roomId, initialRoom, initialParticipants }: Props) {
  const [room, setRoom] = useState<ExamRoom>(initialRoom);
  const [participants, setParticipants] = useState<RoomParticipant[]>(initialParticipants);
  const [filter, setFilter] = useState<'all' | 'doing' | 'submitted'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'score' | 'time'>('progress');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recentEvents, setRecentEvents] = useState<{ id: string; text: string; time: string; type: 'join' | 'submit' | 'progress' }[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addEvent = useCallback((text: string, type: 'join' | 'submit' | 'progress') => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setRecentEvents(prev => [{ id: Math.random().toString(), text, time, type }, ...prev.slice(0, 19)]);
  }, []);

  // ── Sync via API (polling & fallback) ──────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(withBase(`/api/rooms/${room.code}/participants`));
      if (res.ok) {
        const data = await res.json();
        if (data.participants) {
          setParticipants(data.participants);
        }
        if (data.room) {
          setRoom(prev => ({ ...prev, status: data.room.status }));
        }
      }
    } catch (_) {}
  }, [room.code]);

  // ── Supabase Realtime Subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!room.code) return;

    const channel = supabase.channel(`room:${room.code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'joined' }, (payload) => {
        const p = payload.payload?.participant as RoomParticipant | undefined;
        if (p) {
          setParticipants(prev => {
            const exists = prev.some(item => item.id === p.id);
            if (exists) return prev.map(item => item.id === p.id ? { ...item, ...p } : item);
            return [p, ...prev];
          });
          addEvent(`Học sinh "${p.display_name}" vừa tham gia phòng`, 'join');
        }
      })
      .on('broadcast', { event: 'progress' }, (payload) => {
        const { participantId, answeredCount } = payload.payload || {};
        if (participantId !== undefined) {
          setParticipants(prev =>
            prev.map(p => {
              if (p.id === participantId) {
                return { ...p, answered_count: answeredCount ?? p.answered_count };
              }
              return p;
            })
          );
        }
      })
      .on('broadcast', { event: 'submitted' }, (payload) => {
        const { participantId, score, answeredCount, displayName } = payload.payload || {};
        if (participantId) {
          setParticipants(prev =>
            prev.map(p => {
              if (p.id === participantId) {
                return {
                  ...p,
                  score: typeof score === 'number' ? score : p.score,
                  answered_count: typeof answeredCount === 'number' ? answeredCount : p.answered_count,
                  submitted_at: new Date().toISOString(),
                };
              }
              return p;
            })
          );
          const name = displayName || 'Một học sinh';
          const scoreText = typeof score === 'number' ? ` (${score.toFixed(2)}đ)` : '';
          addEvent(`"${name}" đã hoàn thành và nộp bài${scoreText}`, 'submit');
        }
      })
      .on('broadcast', { event: 'room_status' }, (payload) => {
        const { status } = payload.payload || {};
        if (status) {
          setRoom(prev => ({ ...prev, status }));
        }
      })
      // Postgres changes fallback if replication is enabled
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${room.id}` },
        () => {
          fetchParticipants();
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    // Fallback polling every 8s
    pollTimerRef.current = setInterval(fetchParticipants, 8000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      channel.unsubscribe();
    };
  }, [room.code, room.id, fetchParticipants, addEvent]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleActivateRoom() {
    setActionLoading(true);
    try {
      const res = await fetch(withBase('/api/giao-vien/rooms'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        // Broadcast to all students in room
        const channel = supabase.channel(`room:${room.code}`);
        channel.send({
          type: 'broadcast',
          event: 'room_status',
          payload: { status: 'active' },
        });
        addEvent('Giáo viên đã kích hoạt bắt đầu bài thi', 'progress');
      }
    } catch (_) {}
    setActionLoading(false);
  }

  async function handleCloseRoom() {
    if (!confirm('Bạn có chắc chắn muốn đóng phòng thi? Học sinh sẽ không thể làm bài tiếp.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(withBase(`/api/giao-vien/rooms?id=${room.id}`), { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
        // Broadcast close
        const channel = supabase.channel(`room:${room.code}`);
        channel.send({
          type: 'broadcast',
          event: 'room_status',
          payload: { status: 'closed' },
        });
        addEvent('Giáo viên đã kết thúc và đóng phòng thi', 'submit');
      }
    } catch (_) {}
    setActionLoading(false);
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleCopyLink() {
    const link = `${window.location.origin}/thi-online?code=${room.code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }

  function exportCSV() {
    const headers = ['STT', 'Họ và tên', 'Trạng thái', 'Số câu đã làm', 'Tổng số câu', 'Điểm số', 'Thời gian nộp'];
    const rows = participants.map((p, idx) => [
      idx + 1,
      `"${p.display_name.replace(/"/g, '""')}"`,
      p.submitted_at ? 'Đã nộp bài' : 'Đang làm bài',
      p.answered_count,
      p.total_questions,
      p.score !== null ? p.score.toFixed(2) : '',
      p.submitted_at ? formatTime(p.submitted_at) : '',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ket_qua_phong_${room.code}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Metrics & Calculations ────────────────────────────────────────────────
  const submittedList = useMemo(() => participants.filter(p => p.submitted_at !== null), [participants]);
  const doingList = useMemo(() => participants.filter(p => p.submitted_at === null), [participants]);

  const scores = useMemo(() => submittedList.map(p => p.score).filter((s): s is number => typeof s === 'number'), [submittedList]);

  const avgScore = useMemo(() => {
    if (scores.length === 0) return null;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  }, [scores]);

  const maxScore = useMemo(() => (scores.length > 0 ? Math.max(...scores).toFixed(2) : null), [scores]);
  const minScore = useMemo(() => (scores.length > 0 ? Math.min(...scores).toFixed(2) : null), [scores]);

  // Score tiers for distribution
  const scoreTiers = useMemo(() => {
    let tierA = 0; // 8.0 - 10.0 (Giỏi)
    let tierB = 0; // 6.5 - 7.9 (Khá)
    let tierC = 0; // 5.0 - 6.4 (Trung bình)
    let tierD = 0; // < 5.0 (Cần cố gắng)

    scores.forEach(s => {
      if (s >= 8.0) tierA++;
      else if (s >= 6.5) tierB++;
      else if (s >= 5.0) tierC++;
      else tierD++;
    });

    const total = scores.length || 1;
    return {
      tierA: { count: tierA, pct: Math.round((tierA / total) * 100) },
      tierB: { count: tierB, pct: Math.round((tierB / total) * 100) },
      tierC: { count: tierC, pct: Math.round((tierC / total) * 100) },
      tierD: { count: tierD, pct: Math.round((tierD / total) * 100) },
    };
  }, [scores]);

  // ── Filtered & Sorted participants ────────────────────────────────────────
  const filteredParticipants = useMemo(() => {
    return participants
      .filter(p => {
        if (filter === 'doing') return p.submitted_at === null;
        if (filter === 'submitted') return p.submitted_at !== null;
        return true;
      })
      .filter(p => {
        if (!search.trim()) return true;
        return p.display_name.toLowerCase().includes(search.toLowerCase().trim());
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.display_name.localeCompare(b.display_name, 'vi');
        if (sortBy === 'score') {
          return (b.score ?? -1) - (a.score ?? -1);
        }
        if (sortBy === 'time') {
          if (!a.submitted_at) return 1;
          if (!b.submitted_at) return -1;
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
        }
        // default progress
        const pctA = a.total_questions > 0 ? a.answered_count / a.total_questions : 0;
        const pctB = b.total_questions > 0 ? b.answered_count / b.total_questions : 0;
        return pctB - pctA;
      });
  }, [participants, filter, search, sortBy]);

  return (
    <div ref={containerRef} className="space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen p-4 sm:p-6 rounded-2xl">
      {/* ── Top Bar: Title, Room Code, Live Status ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="/giao-vien/phong-thi"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              >
                ← Quản lý phòng
              </a>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  room.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40'
                    : room.status === 'waiting'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {room.status === 'active' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />}
                {room.status === 'waiting' && <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />}
                {room.status === 'active' ? 'Đang thi trực tiếp' : room.status === 'waiting' ? 'Đang chờ vào phòng' : 'Đã kết thúc'}
              </span>

              {/* Realtime WebSocket indicator */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  isRealtimeConnected
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/50'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title={isRealtimeConnected ? 'Supabase Realtime Channel đã kết nối' : 'Đang dùng polling dự phòng'}
              >
                <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-teal-500 animate-pulse' : 'bg-slate-400'}`} />
                {isRealtimeConnected ? 'Realtime WebSocket' : 'Đang kết nối lại...'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {room.exam_title || 'Phòng thi trực tuyến'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-3">
              <span>Thời gian làm bài: <strong className="text-slate-700 dark:text-slate-200">{room.exam_duration ?? 90} phút</strong></span>
              <span>•</span>
              <span>Tạo lúc: <strong className="text-slate-700 dark:text-slate-200">{formatTime(room.created_at)}</strong></span>
            </p>
          </div>

          {/* Room Code Card (Prominent for Projector / Screen sharing) */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4">
            <div className="text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Mã tham gia
              </span>
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                {room.code}
              </span>
            </div>
            <div className="flex sm:flex-col gap-2">
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copiedCode ? 'Đã chép' : 'Sao mã'}
              </button>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-sm transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {copiedLink ? 'Đã chép' : 'Sao link'}
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls & Utilities */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {room.status === 'waiting' && (
              <button
                onClick={handleActivateRoom}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Bắt đầu làm bài
              </button>
            )}

            {room.status !== 'closed' && (
              <button
                onClick={handleCloseRoom}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-semibold text-sm rounded-xl transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Đóng phòng thi
              </button>
            )}

            <button
              onClick={exportCSV}
              disabled={participants.length === 0}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-xl transition flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Xuất CSV kết quả
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình máy chiếu'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Tổng thí sinh</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{participants.length}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Đã vào phòng thi
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-500">Đang làm bài</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{doingList.length}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Đang trả lời câu hỏi
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-500">Đã nộp bài</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{submittedList.length}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {participants.length > 0 ? Math.round((submittedList.length / participants.length) * 100) : 0}% hoàn thành
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-indigo-500">Điểm trung bình</p>
          <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">{avgScore ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Thấp nhất: {minScore ?? '—'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase text-violet-500">Điểm cao nhất</p>
          <p className="text-3xl font-black text-violet-600 dark:text-violet-400 mt-1 tabular-nums">{maxScore ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Đạt điểm tối đa
          </p>
        </div>
      </div>

      {/* ── Score Distribution & Activity Feed Grid ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Distribution */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Phổ điểm trực tiếp (Đã nộp: {submittedList.length})</span>
            <span className="text-xs font-normal text-slate-400">Tự động cập nhật</span>
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-600 dark:text-emerald-400">Giỏi / Xuất sắc (8.0 - 10.0)</span>
                <span className="text-slate-700 dark:text-slate-300">{scoreTiers.tierA.count} em ({scoreTiers.tierA.pct}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${scoreTiers.tierA.pct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-600 dark:text-blue-400">Khá (6.5 - 7.9)</span>
                <span className="text-slate-700 dark:text-slate-300">{scoreTiers.tierB.count} em ({scoreTiers.tierB.pct}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${scoreTiers.tierB.pct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-amber-600 dark:text-amber-400">Trung bình (5.0 - 6.4)</span>
                <span className="text-slate-700 dark:text-slate-300">{scoreTiers.tierC.count} em ({scoreTiers.tierC.pct}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${scoreTiers.tierC.pct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-rose-600 dark:text-rose-400">Cần cố gắng (&lt; 5.0)</span>
                <span className="text-slate-700 dark:text-slate-300">{scoreTiers.tierD.count} em ({scoreTiers.tierD.pct}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full transition-all duration-500"
                  style={{ width: `${scoreTiers.tierD.pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Nhật ký trực tiếp
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Live Feed</span>
          </h2>

          <div className="flex-1 overflow-y-auto max-h-56 space-y-2 pr-1 text-xs">
            {recentEvents.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 italic py-6 text-center">
                Đang chờ hoạt động từ học sinh...
              </p>
            ) : (
              recentEvents.map(evt => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        evt.type === 'submit' ? 'bg-emerald-500' : evt.type === 'join' ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{evt.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{evt.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Participants Table with Filters & Search ────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                filter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tất cả ({participants.length})
            </button>
            <button
              onClick={() => setFilter('doing')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                filter === 'doing'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Đang làm ({doingList.length})
            </button>
            <button
              onClick={() => setFilter('submitted')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
                filter === 'submitted'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Đã nộp ({submittedList.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tên học sinh..."
                className="w-48 sm:w-60 px-3.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="progress">Xếp theo: Tiến độ</option>
              <option value="score">Xếp theo: Điểm cao nhất</option>
              <option value="name">Xếp theo: Tên (A-Z)</option>
              <option value="time">Xếp theo: Giờ nộp bài</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredParticipants.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-semibold text-slate-600 dark:text-slate-400">Không tìm thấy thí sinh nào</p>
            <p className="text-xs mt-1 text-slate-400">
              {participants.length === 0
                ? `Chia sẻ mã phòng ${room.code} để học sinh tham gia`
                : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Học sinh</th>
                  <th className="px-5 py-3.5">Tiến độ làm bài</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Điểm số</th>
                  <th className="px-5 py-3.5 text-right">Giờ nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredParticipants.map((p, idx) => {
                  const pct = p.total_questions > 0 ? Math.round((p.answered_count / p.total_questions) * 100) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                            {p.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{p.display_name}</p>
                            <span className="text-[11px] text-slate-400 font-mono">ID: {p.id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 min-w-[180px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                            <span>{p.answered_count}/{p.total_questions} câu</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                p.submitted_at
                                  ? 'bg-emerald-500'
                                  : 'bg-gradient-to-r from-amber-400 to-teal-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.submitted_at ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Đã nộp bài
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Đang làm bài
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-base tabular-nums">
                        {p.score !== null ? (
                          <span
                            className={
                              p.score >= 8.0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : p.score >= 6.5
                                ? 'text-blue-600 dark:text-blue-400'
                                : p.score >= 5.0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {p.score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {formatTime(p.submitted_at)}
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
