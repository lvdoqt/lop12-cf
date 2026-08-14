import { useState, useEffect, useRef, useCallback } from 'react';

type Mode = 'countdown' | 'stopwatch';
type TimerState = 'idle' | 'running' | 'paused' | 'finished';

interface Preset {
  label: string;
  seconds: number;
  color: string;
}

const PRESETS: Preset[] = [
  { label: '1 phút', seconds: 60, color: 'from-emerald-500 to-teal-500' },
  { label: '3 phút', seconds: 180, color: 'from-cyan-500 to-blue-500' },
  { label: '5 phút', seconds: 300, color: 'from-blue-500 to-indigo-500' },
  { label: '10 phút', seconds: 600, color: 'from-indigo-500 to-purple-500' },
  { label: '15 phút', seconds: 900, color: 'from-purple-500 to-pink-500' },
  { label: '45 phút', seconds: 2700, color: 'from-pink-500 to-rose-500' },
];

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(totalSeconds: number): { hours: string; minutes: string; seconds: string } {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { hours: padTwo(h), minutes: padTwo(m), seconds: padTwo(s) };
}

// Generate alarm beep using Web Audio API
function playAlarm(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    // Play 3 beeps
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 880 : 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch {
    // Audio not supported
  }
}

export default function TimerApp() {
  const [mode, setMode] = useState<Mode>('countdown');
  const [state, setState] = useState<TimerState>('idle');
  const [totalSeconds, setTotalSeconds] = useState(300); // default 5 min
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [customMinutes, setCustomMinutes] = useState('5');
  const [customSeconds, setCustomSeconds] = useState('0');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        if (state === 'idle') handleStart();
        else if (state === 'running') handlePause();
        else if (state === 'paused') handleResume();
        else if (state === 'finished') handleReset();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, totalSeconds, mode]);

  const handleStart = useCallback(() => {
    if (mode === 'countdown') {
      setRemainingSeconds(totalSeconds);
      setState('running');
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setState('finished');
            if (soundEnabled) playAlarm(audioCtxRef);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setElapsedSeconds(0);
      setState('running');
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
  }, [mode, totalSeconds, soundEnabled]);

  const handlePause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState('paused');
  }, []);

  const handleResume = useCallback(() => {
    setState('running');
    if (mode === 'countdown') {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setState('finished');
            if (soundEnabled) playAlarm(audioCtxRef);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
  }, [mode, soundEnabled]);

  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState('idle');
    setRemainingSeconds(totalSeconds);
    setElapsedSeconds(0);
  }, [totalSeconds]);

  const selectPreset = (seconds: number) => {
    if (state === 'running') return;
    handleReset();
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setCustomMinutes(Math.floor(seconds / 60).toString());
    setCustomSeconds((seconds % 60).toString());
  };

  const applyCustomTime = () => {
    const m = parseInt(customMinutes) || 0;
    const s = parseInt(customSeconds) || 0;
    const total = m * 60 + s;
    if (total > 0) {
      setTotalSeconds(total);
      setRemainingSeconds(total);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const switchMode = (newMode: Mode) => {
    handleReset();
    setMode(newMode);
  };

  // Calculate progress for countdown ring
  const displaySeconds = mode === 'countdown' ? remainingSeconds : elapsedSeconds;
  const time = formatTime(displaySeconds);
  const progress = mode === 'countdown'
    ? totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) : 0
    : 0;

  // Color states
  const isUrgent = mode === 'countdown' && state === 'running' && remainingSeconds <= 10 && remainingSeconds > 0;
  const isFinished = state === 'finished';

  const ringColor = isFinished
    ? 'stroke-rose-500'
    : isUrgent
      ? 'stroke-amber-500'
      : 'stroke-blue-500';

  const digitColor = isFinished
    ? 'text-rose-500 dark:text-rose-400'
    : isUrgent
      ? 'text-amber-500 dark:text-amber-400 animate-pulse'
      : isFullscreen ? 'text-white' : 'text-gray-900 dark:text-white';

  return (
    <div
      ref={containerRef}
      className={`min-h-screen ${isFullscreen ? 'bg-gray-950 flex flex-col items-center justify-center p-4' : ''}`}
    >
      {/* Mode tabs */}
      {!isFullscreen && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => switchMode('countdown')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'countdown'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            ⏱️ Đếm ngược
          </button>
          <button
            onClick={() => switchMode('stopwatch')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'stopwatch'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            ⏳ Bấm giờ
          </button>
        </div>
      )}

      {/* Timer display */}
      <div className={`flex flex-col items-center ${isFullscreen ? 'gap-8' : 'gap-6'}`}>
        {/* SVG Ring + Digits */}
        <div className="relative">
          <svg
            className={`${isFullscreen ? 'w-[420px] h-[420px]' : 'w-72 h-72 md:w-80 md:h-80'}`}
            viewBox="0 0 200 200"
          >
            {/* Background ring */}
            <circle
              cx="100" cy="100" r="88"
              fill="none"
              stroke="currentColor"
              className="text-gray-200 dark:text-slate-800"
              strokeWidth="6"
            />
            {/* Progress ring (countdown only) */}
            {mode === 'countdown' && (
              <circle
                cx="100" cy="100" r="88"
                fill="none"
                className={`${ringColor} transition-all duration-700`}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 88}
                strokeDashoffset={2 * Math.PI * 88 * (1 - progress)}
                transform="rotate(-90 100 100)"
              />
            )}
            {/* Glow ring for stopwatch */}
            {mode === 'stopwatch' && state === 'running' && (
              <circle
                cx="100" cy="100" r="88"
                fill="none"
                className="stroke-emerald-500 opacity-60"
                strokeWidth="6"
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Time digits overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex items-baseline ${isFullscreen ? 'gap-2' : 'gap-1'}`}>
              {parseInt(time.hours) > 0 && (
                <>
                  <span className={`${isFullscreen ? 'text-8xl' : 'text-6xl md:text-7xl'} font-black tabular-nums ${digitColor} transition-colors`}>
                    {time.hours}
                  </span>
                  <span className={`${isFullscreen ? 'text-5xl' : 'text-4xl'} font-bold ${digitColor} opacity-50 -mx-1`}>:</span>
                </>
              )}
              <span className={`${isFullscreen ? 'text-8xl' : 'text-6xl md:text-7xl'} font-black tabular-nums ${digitColor} transition-colors`}>
                {time.minutes}
              </span>
              <span className={`${isFullscreen ? 'text-5xl' : 'text-4xl'} font-bold ${digitColor} opacity-50 -mx-1 ${state === 'running' ? 'animate-pulse' : ''}`}>:</span>
              <span className={`${isFullscreen ? 'text-8xl' : 'text-6xl md:text-7xl'} font-black tabular-nums ${digitColor} transition-colors`}>
                {time.seconds}
              </span>
            </div>
          </div>
        </div>

        {/* Finished message */}
        {isFinished && (
          <div className={`text-center ${isFullscreen ? 'mb-4' : ''}`}>
            <p className="text-2xl md:text-3xl font-black text-rose-400 animate-bounce">
              ⏰ Hết giờ!
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {state === 'idle' && (
            <button
              onClick={handleStart}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
            >
              ▶️ Bắt đầu
            </button>
          )}
          {state === 'running' && (
            <button
              onClick={handlePause}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg shadow-xl shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
            >
              ⏸️ Tạm dừng
            </button>
          )}
          {state === 'paused' && (
            <>
              <button
                onClick={handleResume}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-lg shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
              >
                ▶️ Tiếp tục
              </button>
            </>
          )}
          {state === 'finished' && (
            <button
              onClick={handleReset}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-lg shadow-xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
            >
              🔄 Đặt lại
            </button>
          )}
          {(state === 'running' || state === 'paused') && (
            <button
              onClick={handleReset}
              className="px-5 py-3.5 rounded-2xl border-2 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            >
              ↩️ Reset
            </button>
          )}
        </div>

        {/* Utility buttons row */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
          >
            {isFullscreen ? '🔲 Thu nhỏ' : '🔳 Toàn màn hình'}
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
            }`}
          >
            {soundEnabled ? '🔔 Bật chuông' : '🔕 Tắt chuông'}
          </button>
          {isFullscreen && (
            <button
              onClick={() => switchMode(mode === 'countdown' ? 'stopwatch' : 'countdown')}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
            >
              {mode === 'countdown' ? '⏳ Chuyển sang Bấm giờ' : '⏱️ Chuyển sang Đếm ngược'}
            </button>
          )}
        </div>
      </div>

      {/* Presets (countdown only, not fullscreen) */}
      {mode === 'countdown' && !isFullscreen && (
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
            Preset nhanh
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PRESETS.map(p => (
              <button
                key={p.seconds}
                onClick={() => selectPreset(p.seconds)}
                disabled={state === 'running'}
                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  totalSeconds === p.seconds && state === 'idle'
                    ? `bg-gradient-to-r ${p.color} text-white shadow-lg scale-105`
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                } ${state === 'running' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom time input */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-sm font-semibold text-gray-600 dark:text-slate-400">Tùy chỉnh:</span>
            <input
              type="number"
              min="0"
              max="180"
              value={customMinutes}
              onChange={e => setCustomMinutes(e.target.value)}
              disabled={state === 'running'}
              className="w-20 px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-center font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              placeholder="Phút"
            />
            <span className="font-bold text-gray-400">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={customSeconds}
              onChange={e => setCustomSeconds(e.target.value)}
              disabled={state === 'running'}
              className="w-20 px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-center font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              placeholder="Giây"
            />
            <button
              onClick={applyCustomTime}
              disabled={state === 'running'}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow transition disabled:opacity-50"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {!isFullscreen && (
        <div className="mt-8 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
            ⌨️ Phím tắt
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-blue-800/80 dark:text-blue-200/70 font-medium">
            <span><kbd className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border text-xs font-bold">Space</kbd> Bắt đầu / Tạm dừng</span>
            <span><kbd className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border text-xs font-bold">R</kbd> Đặt lại</span>
            <span><kbd className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border text-xs font-bold">F</kbd> Toàn màn hình</span>
          </div>
        </div>
      )}

      {/* Fullscreen presets (simplified) */}
      {mode === 'countdown' && isFullscreen && state === 'idle' && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {PRESETS.map(p => (
            <button
              key={p.seconds}
              onClick={() => selectPreset(p.seconds)}
              className={`px-6 py-3 rounded-2xl font-bold text-base transition-all ${
                totalSeconds === p.seconds
                  ? `bg-gradient-to-r ${p.color} text-white shadow-xl scale-110`
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              } hover:scale-105 active:scale-95`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
