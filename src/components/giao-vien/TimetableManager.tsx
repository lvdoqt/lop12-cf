import React, { useState, useEffect } from 'react';

type InputMode = 'manual' | 'image';

interface TimetableData {
  [day: string]: {
    [period: string]: string;
  };
}

export default function TimetableManager() {
  const [mode, setMode] = useState<InputMode>('manual');
  const [gridData, setGridData] = useState<TimetableData>({});
  const [imageData, setImageData] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const periods = [
    { id: 'm1', label: 'Tiết 1', session: 'Sáng' },
    { id: 'm2', label: 'Tiết 2', session: 'Sáng' },
    { id: 'm3', label: 'Tiết 3', session: 'Sáng' },
    { id: 'm4', label: 'Tiết 4', session: 'Sáng' },
    { id: 'm5', label: 'Tiết 5', session: 'Sáng' },
    { id: 'a1', label: 'Tiết 1', session: 'Chiều' },
    { id: 'a2', label: 'Tiết 2', session: 'Chiều' },
    { id: 'a3', label: 'Tiết 3', session: 'Chiều' },
    { id: 'a4', label: 'Tiết 4', session: 'Chiều' },
    { id: 'a5', label: 'Tiết 5', session: 'Chiều' },
  ];

  useEffect(() => {
    // Load from local storage on mount
    const savedGrid = localStorage.getItem('lop12_timetable_grid');
    const savedImage = localStorage.getItem('lop12_timetable_image');
    const savedMode = localStorage.getItem('lop12_timetable_mode') as InputMode;

    if (savedGrid) {
      try {
        setGridData(JSON.parse(savedGrid));
      } catch (e) {
        console.error('Failed to parse grid data', e);
      }
    }
    if (savedImage) setImageData(savedImage);
    if (savedMode) setMode(savedMode);
  }, []);

  const saveToLocalStorage = () => {
    localStorage.setItem('lop12_timetable_grid', JSON.stringify(gridData));
    if (imageData) {
      localStorage.setItem('lop12_timetable_image', imageData);
    } else {
      localStorage.removeItem('lop12_timetable_image');
    }
    localStorage.setItem('lop12_timetable_mode', mode);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCellChange = (day: string, periodId: string, value: string) => {
    setGridData(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [periodId]: value
      }
    }));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (mode !== 'image') return;
    
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
              setImageData(event.target.result);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setImageData(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageData(null);
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'manual' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            ✍️ Nhập tay
          </button>
          <button
            onClick={() => setMode('image')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === 'image' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            🖼️ Dán ảnh TKB
          </button>
        </div>

        <button
          onClick={saveToLocalStorage}
          className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-sm transition-all flex items-center gap-2 ${
            isSaved 
              ? 'bg-emerald-500 hover:bg-emerald-600' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSaved ? '✓ Đã lưu' : '💾 Lưu thay đổi'}
        </button>
      </div>

      {/* Manual Mode Grid */}
      {mode === 'manual' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 border-b dark:border-slate-700 font-bold text-center w-24">Buổi</th>
                  <th className="px-4 py-3 border-b dark:border-slate-700 font-bold text-center w-20">Tiết</th>
                  {days.map(day => (
                    <th key={day} className="px-4 py-3 border-b border-l dark:border-slate-700 font-bold text-center min-w-[120px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period, index) => {
                  const isFirstOfSession = index === 0 || period.session !== periods[index - 1].session;
                  const sessionRowspan = periods.filter(p => p.session === period.session).length;
                  
                  return (
                    <tr key={period.id} className="border-b dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                      {isFirstOfSession && (
                        <td 
                          rowSpan={sessionRowspan} 
                          className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-slate-800/20 border-r dark:border-slate-700"
                        >
                          <div className="flex items-center justify-center -rotate-90 sm:rotate-0 tracking-widest sm:tracking-normal uppercase sm:capitalize">
                            {period.session}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center font-medium text-gray-500 dark:text-slate-400 border-r dark:border-slate-700">
                        {period.label}
                      </td>
                      {days.map(day => (
                        <td key={`${day}-${period.id}`} className="p-1 border-l dark:border-slate-700/50 relative group">
                          <input
                            type="text"
                            placeholder="Lớp - Môn..."
                            value={gridData[day]?.[period.id] || ''}
                            onChange={(e) => handleCellChange(day, period.id, e.target.value)}
                            className="w-full h-full min-h-[40px] px-2 py-1 text-center bg-transparent border-none focus:ring-2 focus:ring-blue-500 dark:text-white rounded outline-none placeholder:text-gray-300 dark:placeholder:text-slate-600"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image Mode */}
      {mode === 'image' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          {imageData ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Ảnh Thời khoá biểu:</h3>
                <button 
                  onClick={handleRemoveImage}
                  className="text-xs px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-semibold"
                >
                  Xoá ảnh
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800/50 flex justify-center p-2">
                <img src={imageData} alt="TKB" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-slate-400">
                (Bạn có thể nhấn Ctrl+V hoặc Cmd+V để dán đè ảnh mới)
              </p>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Nhấn Ctrl+V (hoặc Cmd+V) để dán ảnh vào đây
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm">
                Chụp ảnh màn hình thời khoá biểu của bạn và dán trực tiếp vào trang này, hoặc tải file ảnh lên.
              </p>
              
              <label className="cursor-pointer bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Chọn file ảnh...
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
