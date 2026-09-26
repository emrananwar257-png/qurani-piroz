import React, { useState } from 'react';

const SimpleMushaf = () => {
  const [selected, setSelected] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // ئەم ئایەتانە دەبێت هەبن
  const ayahs = [
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    'الرَّحْمَٰنِ الرَّحِيمِ',
    'مَالِكِ يَوْمِ الدِّينِ',
    'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
    'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ',
  ];

  const handleClick = (e, ayah) => {
    setSelected(ayah);
    setShowMenu(true);
    setPos({
      x: e.clientX - 80,
      y: e.clientY - 60,
    });
  };

  const copyText = () => {
    navigator.clipboard.writeText(selected);
    alert('✅ کۆپی کرا!');
    setShowMenu(false);
  };

  const shareText = () => {
    if (navigator.share) {
      navigator.share({ text: selected });
    } else {
      copyText();
    }
    setShowMenu(false);
  };

  return (
    <div className="min-h-screen bg-amber-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-6">
        <h2 className="text-center text-2xl font-bold text-amber-800 mb-6">📖 قورئانی پیرۆز</h2>
        
        {ayahs.map((ayah, i) => (
          <div
            key={i}
            onClick={(e) => handleClick(e, ayah)}
            className={`p-4 rounded-2xl cursor-pointer transition-all mb-2 ${
              selected === ayah ? 'bg-amber-200 border-r-4 border-amber-600' : 'hover:bg-amber-50'
            }`}
          >
            <p className="text-right text-2xl font-serif leading-loose">{ayah}</p>
            <span className="text-xs text-amber-600">({i + 1})</span>
          </div>
        ))}
      </div>

      {showMenu && (
        <div
          className="fixed bg-white shadow-2xl rounded-2xl p-3 flex gap-2 z-50 border border-amber-200"
          style={{ left: pos.x, top: pos.y }}
        >
          <button onClick={copyText} className="px-4 py-2 bg-amber-100 rounded-xl text-sm font-bold">📋 کۆپی</button>
          <button onClick={shareText} className="px-4 py-2 bg-blue-100 rounded-xl text-sm font-bold">📤 هاوبەش</button>
          <button onClick={() => setShowMenu(false)} className="px-3 py-2 bg-gray-100 rounded-xl">✕</button>
        </div>
      )}
    </div>
  );
};

export default SimpleMushaf;
