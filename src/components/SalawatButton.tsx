'use client';

import { useState, useCallback } from 'react';

const SALAWAT_LIST = [
  'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
  'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ',
  'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
];

export default function SalawatButton() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');

  const copySalawat = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('✓ Copied');
      setTimeout(() => setToast(''), 2000);
    } catch {
      setToast('✓ Copied');
      setTimeout(() => setToast(''), 2000);
    }
  }, []);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 shadow-2xl shadow-black/50 animate-scale-in">
            {SALAWAT_LIST.map((s, i) => (
              <button
                key={i}
                onClick={() => copySalawat(s)}
                className="w-full text-right px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <p className="font-arabic text-base text-gray-200 leading-relaxed">{s}</p>
                <span className="text-[10px] text-gray-500">tap to copy</span>
              </button>
            ))}
          </div>
        )}
        
        <button
          onClick={() => setOpen(!open)}
          className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center text-xl shadow-lg shadow-amber-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
          title="الصلاة على النبي"
        >
          ﷺ
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-24 right-6 z-50 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg animate-slide-up">
          {toast}
        </div>
      )}
    </>
  );
}
