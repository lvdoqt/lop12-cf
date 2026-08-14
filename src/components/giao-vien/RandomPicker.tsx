import { useState, useEffect, useCallback, useRef } from 'react';

interface ClassList {
  id: string;
  name: string;
  students: string[];
}

type PickMode = 'single' | 'group';

// Easing function for deceleration
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function RandomPicker() {
  const [classes, setClasses] = useState<ClassList[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [className, setClassName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [pickMode, setPickMode] = useState<PickMode>('single');
  const [groupCount, setGroupCount] = useState(2);
  const [calledStudents, setCalledStudents] = useState<Set<string>>(new Set());
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<string | null>(null);
  const [pickedResult, setPickedResult] = useState<string | string[][] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const spinIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load classes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lop12-random-picker-classes');
      if (saved) {
        const parsed: ClassList[] = JSON.parse(saved);
        setClasses(parsed);
        if (parsed.length > 0) setActiveClassId(parsed[0].id);
      }
    } catch { /* empty */ }
  }, []);

  // Save classes to localStorage
  useEffect(() => {
    if (classes.length > 0) {
      localStorage.setItem('lop12-random-picker-classes', JSON.stringify(classes));
    }
  }, [classes]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const activeClass = classes.find(c => c.id === activeClassId);
  const availableStudents = activeClass
    ? activeClass.students.filter(s => !calledStudents.has(s))
    : [];

  const addClass = () => {
    const students = inputText
      .split('\n')
      .map(s => s.replace(/^\d+[\.\)\s]+/, '').trim()) // remove leading numbers like "1. ", "2) "
      .filter(s => s.length > 0);

    if (students.length === 0 || !className.trim()) return;

    const newClass: ClassList = {
      id: Date.now().toString(36),
      name: className.trim(),
      students,
    };
    setClasses(prev => [...prev, newClass]);
    setActiveClassId(newClass.id);
    setInputText('');
    setClassName('');
    setShowAddForm(false);
    setCalledStudents(new Set());
    setPickedResult(null);
  };

  const deleteClass = (id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
    if (activeClassId === id) {
      setActiveClassId(classes.length > 1 ? classes.find(c => c.id !== id)?.id || null : null);
    }
    setCalledStudents(new Set());
    setPickedResult(null);
  };

  const resetCalled = () => {
    setCalledStudents(new Set());
    setPickedResult(null);
    setCurrentDisplay(null);
  };

  const pickSingle = useCallback(() => {
    if (!activeClass || availableStudents.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setPickedResult(null);

    const winner = availableStudents[Math.floor(Math.random() * availableStudents.length)];
    const allStudents = activeClass.students;
    const totalDuration = 2000; // 2 seconds spin
    const totalSteps = 25;
    let step = 0;

    const spin = () => {
      step++;
      const progress = step / totalSteps;

      if (step < totalSteps) {
        // Show random names during spin
        const randomStudent = allStudents[Math.floor(Math.random() * allStudents.length)];
        setCurrentDisplay(randomStudent);
        const delay = 50 + easeOutCubic(progress) * 200; // speeds up delay (decelerating)
        spinIntervalRef.current = setTimeout(spin, delay);
      } else {
        // Final reveal
        setCurrentDisplay(winner);
        setPickedResult(winner);
        setCalledStudents(prev => new Set(prev).add(winner));
        setIsSpinning(false);
      }
    };

    spin();
  }, [activeClass, availableStudents, isSpinning]);

  const pickGroups = useCallback(() => {
    if (!activeClass || availableStudents.length === 0) return;

    const shuffled = [...availableStudents].sort(() => Math.random() - 0.5);
    const groups: string[][] = Array.from({ length: groupCount }, () => []);
    shuffled.forEach((student, i) => {
      groups[i % groupCount].push(student);
    });
    setPickedResult(groups);
  }, [activeClass, availableStudents, groupCount]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const GROUP_COLORS = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-pink-500 to-rose-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-sky-600',
    'from-lime-500 to-green-600',
    'from-fuchsia-500 to-pink-600',
  ];

  return (
    <div ref={containerRef} className={isFullscreen ? 'bg-gray-950 min-h-screen p-6 flex flex-col' : ''}>
      {/* Class selector + controls */}
      {!isFullscreen && (
        <div className="space-y-4 mb-6">
          {/* Class tabs */}
          {classes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {classes.map(c => (
                <div key={c.id} className="flex items-center">
                  <button
                    onClick={() => {
                      setActiveClassId(c.id);
                      setCalledStudents(new Set());
                      setPickedResult(null);
                      setCurrentDisplay(null);
                    }}
                    className={`px-4 py-2 rounded-l-xl text-sm font-bold transition-all ${
                      activeClassId === c.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {c.name} ({c.students.length})
                  </button>
                  <button
                    onClick={() => deleteClass(c.id)}
                    className={`px-2 py-2 rounded-r-xl text-sm font-bold transition-all ${
                      activeClassId === c.id
                        ? 'bg-blue-700 text-blue-200 hover:bg-red-600 hover:text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400 hover:bg-red-500 hover:text-white'
                    }`}
                    title="Xóa lớp"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition border border-emerald-200 dark:border-emerald-800/50"
              >
                + Thêm lớp
              </button>
            </div>
          )}

          {/* Add class form */}
          {(showAddForm || classes.length === 0) && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {classes.length === 0 ? '📋 Thêm danh sách lớp đầu tiên' : '📋 Thêm danh sách lớp'}
              </h3>
              <input
                type="text"
                value={className}
                onChange={e => setClassName(e.target.value)}
                placeholder="Tên lớp (VD: 12A1)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={"Dán danh sách HS (mỗi dòng 1 tên):\n1. Nguyễn Văn A\n2. Trần Thị B\n3. Lê Văn C\n..."}
                rows={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={addClass}
                  disabled={!className.trim() || !inputText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ Lưu danh sách
                </button>
                {classes.length > 0 && (
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main picker area */}
      {activeClass && (
        <div className={`flex flex-col items-center ${isFullscreen ? 'flex-1 justify-center' : ''}`}>
          {/* Mode toggle & controls */}
          <div className="flex items-center gap-3 mb-6 flex-wrap justify-center">
            <button
              onClick={() => { setPickMode('single'); setPickedResult(null); }}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                pickMode === 'single'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              🎯 Bốc 1 bạn
            </button>
            <button
              onClick={() => { setPickMode('group'); setPickedResult(null); }}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                pickMode === 'group'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              👥 Chia nhóm
            </button>
            {pickMode === 'group' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-slate-400">Số nhóm:</span>
                <select
                  value={groupCount}
                  onChange={e => setGroupCount(parseInt(e.target.value))}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} nhóm</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Single Pick Display */}
          {pickMode === 'single' && (
            <div className="flex flex-col items-center gap-6">
              {/* Main display card */}
              <div className={`relative overflow-hidden rounded-3xl ${
                isFullscreen ? 'w-[600px] min-h-[300px]' : 'w-80 md:w-96 min-h-[200px]'
              } flex items-center justify-center ${
                pickedResult
                  ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl shadow-orange-500/40'
                  : isSpinning
                    ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/40'
                    : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 shadow-xl'
              } transition-all duration-500`}>
                {/* Animated confetti background for winner */}
                {pickedResult && typeof pickedResult === 'string' && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full animate-bounce"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          backgroundColor: ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa', '#fb923c'][i % 6],
                          animationDelay: `${Math.random() * 2}s`,
                          animationDuration: `${0.5 + Math.random() * 1.5}s`,
                          opacity: 0.7,
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="text-center p-8 relative z-10">
                  {currentDisplay ? (
                    <>
                      {pickedResult && typeof pickedResult === 'string' && (
                        <p className="text-white/80 text-lg font-bold mb-2 animate-bounce">
                          🎉 Chúc mừng!
                        </p>
                      )}
                      <p className={`font-black text-white leading-tight ${
                        isFullscreen ? 'text-6xl md:text-7xl' : 'text-4xl md:text-5xl'
                      } ${isSpinning ? 'blur-[1px]' : ''} transition-all`}>
                        {currentDisplay}
                      </p>
                    </>
                  ) : (
                    <p className="text-white/40 text-lg font-semibold">
                      {availableStudents.length > 0
                        ? 'Bấm "Quay" để bốc thăm'
                        : 'Đã gọi hết! Bấm "Reset" để bắt đầu lại'}
                    </p>
                  )}
                </div>
              </div>

              {/* Spin button */}
              <button
                onClick={pickSingle}
                disabled={isSpinning || availableStudents.length === 0}
                className={`px-10 py-4 rounded-2xl font-black text-xl transition-all ${
                  isSpinning
                    ? 'bg-gray-400 text-white cursor-not-allowed animate-pulse'
                    : availableStudents.length === 0
                      ? 'bg-gray-300 dark:bg-slate-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xl shadow-orange-500/30 hover:scale-110 active:scale-95'
                }`}
              >
                {isSpinning ? '🎰 Đang quay...' : '🎲 Quay!'}
              </button>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">
                  ✓ Đã gọi: {calledStudents.size}/{activeClass.students.length}
                </span>
                <span className="text-gray-500 dark:text-slate-400">
                  Còn lại: {availableStudents.length}
                </span>
                <button
                  onClick={resetCalled}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ↩️ Reset
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                >
                  {isFullscreen ? '🔲 Thu nhỏ' : '🔳 Toàn màn hình'}
                </button>
              </div>

              {/* Called students list */}
              {calledStudents.size > 0 && !isFullscreen && (
                <div className="w-full max-w-md mt-2 bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Đã gọi ({calledStudents.size})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(calledStudents).map(name => (
                      <span
                        key={name}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Group Pick Display */}
          {pickMode === 'group' && (
            <div className="w-full max-w-4xl space-y-6">
              <div className="flex justify-center gap-3">
                <button
                  onClick={pickGroups}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-lg shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  🔀 Chia nhóm ngẫu nhiên
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="px-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                >
                  {isFullscreen ? '🔲 Thu nhỏ' : '🔳 Toàn màn hình'}
                </button>
              </div>

              {/* Groups display */}
              {Array.isArray(pickedResult) && (
                <div className={`grid gap-4 ${
                  (pickedResult as string[][]).length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
                  (pickedResult as string[][]).length <= 4 ? 'grid-cols-2' :
                  'grid-cols-2 lg:grid-cols-3'
                }`}>
                  {(pickedResult as string[][]).map((group, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${GROUP_COLORS[i % GROUP_COLORS.length]} text-white font-black text-sm flex items-center justify-center shadow`}>
                          {i + 1}
                        </span>
                        <h4 className="font-bold text-gray-900 dark:text-white">
                          Nhóm {i + 1}
                          <span className="ml-2 text-xs text-gray-400 font-semibold">({group.length} HS)</span>
                        </h4>
                      </div>
                      <div className="space-y-1.5">
                        {group.map((name, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm font-medium text-gray-800 dark:text-slate-200"
                          >
                            <span className="text-gray-400 text-xs font-bold w-5 text-right">{j + 1}.</span>
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No class selected prompt */}
      {!activeClass && classes.length > 0 && !showAddForm && (
        <div className="text-center py-12 text-gray-500 dark:text-slate-400">
          <p className="text-lg font-semibold">Chọn một lớp ở trên để bắt đầu</p>
        </div>
      )}
    </div>
  );
}
