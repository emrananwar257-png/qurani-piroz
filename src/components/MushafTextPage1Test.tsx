import React, { useEffect, useState } from 'react';

const PAGE_1_LINES: { text: string; centered: boolean }[] = [
  { text: 'ﱁ ﱂ ﱃ ﱄ ﱅ', centered: true },
  { text: 'ﱆ ﱇ ﱈ ﱉ ﱊ', centered: true },
  { text: 'ﱋ ﱌ ﱍ ﱎ ﱏ ﱐ ﱑ', centered: true },
  { text: 'ﱒ ﱓ ﱔ ﱕ ﱖ ﱗ', centered: true },
  { text: 'ﱘ ﱙ ﱚ ﱛ ﱜ ﱝ', centered: true },
  { text: 'ﱞ ﱟ ﱠ ﱡ', centered: true },
  { text: 'ﱢ ﱣ ﱤ', centered: true },
];

export const MushafTextPage1Test: React.FC = () => {
  // بەکارهێنانی ناوی ڕەهای ڕیپۆزیتۆرییەکە بۆ دڵنیابوون لە دۆزینەوەی فۆنتەکە لە GitHub Pages
  const fontUrl = '/qurani-piroz/fonts/p1.ttf';
  const [fontStatus, setFontStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    const font = new FontFace('qcf-p1-check', `url('${fontUrl}')`);
    font.load()
      .then(() => setFontStatus('loaded'))
      .catch(() => setFontStatus('failed'));
  }, [fontUrl]);

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4" dir="rtl">
      <style>{`
        @font-face {
          font-family: 'qcf-p1';
          src: url('/qurani-piroz/fonts/p1.ttf') format('truetype');
          font-display: swap;
        }
        .qcf-line {
          font-family: 'qcf-p1', serif;
        }
      `}</style>

      <div className="relative bg-[#fdfcf7] border border-stone-300 rounded-lg shadow-xl w-full max-w-md p-6"
           style={{ aspectRatio: '1260 / 1980' }}>
        <div className="border-2 border-stone-800 rounded px-4 py-2 text-center mb-6 mt-4">
          <span className="text-lg font-bold text-stone-900" style={{ fontFamily: 'serif' }}>
            سُورَةُ الْفَاتِحَةِ
          </span>
        </div>

        <div className="flex flex-col items-center gap-4 px-2 mt-8">
          {PAGE_1_LINES.map((line, i) => (
            <p
              key={i}
              className="qcf-line text-stone-900 select-text"
              style={{ fontSize: '38px', lineHeight: '2.2', textAlign: line.centered ? 'center' : 'right', width: '100%' }}
            >
              {line.text}
            </p>
          ))}
        </div>

        <div className="absolute bottom-3 inset-x-0 text-center text-xs text-stone-500 font-mono">1</div>

        <div className={`absolute top-1 inset-x-0 text-center text-[10px] font-bold ${
          fontStatus === 'loaded' ? 'text-green-600' : fontStatus === 'failed' ? 'text-red-600' : 'text-slate-400'
        }`}>
          {fontStatus === 'loading' && 'فۆنت باردەکرێت...'}
          {fontStatus === 'loaded' && '✓ فۆنت بە سەرکەوتوویی بارکرا'}
          {fontStatus === 'failed' && `✗ فۆنت نەدۆزرایەوە لە: ${fontUrl}`}
        </div>
      </div>
    </div>
  );
};
