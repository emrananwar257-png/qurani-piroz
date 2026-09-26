import React, { useState } from 'react';
import { BookMarked, Volume2 } from 'lucide-react';

const SCHOLARS_LIST = [
  {
    id: 'mudarris',
    name: 'مامۆستا مەلا عەبدولکەریمی مودەڕڕیس',
    title: 'عەللامە و مەرجەعی باڵای کوردستان (١٩٠٥ - ٢٠٠٥)',
    bio: 'گەورەترین زانا و موفەسیری مێژووی هاوچەرخی کورد کە زیاتر لە ٦٠ پەرتووکی بەنرخی نووسیوە.',
    books: ['تەفسیری نامی (٦ بەرگ)', 'شەریعەتی ئیسلام', 'سەرچاوەی ئایین', 'بارانی ڕەحمەت'],
    audioSeriesTitle: 'شیکردنەوەی تەفسیری نامی و حوکمە فیقهییەکان'
  },
  {
    id: 'ali_bapir',
    name: 'مامۆستا عەلی باپیر',
    title: 'نووسەر و بیرمەندی پایەبەرز',
    bio: 'خاوەنی دەیان پەرتووکی دەوڵەمەند لە بوارەکانی تەفسیر، عەقیدە و فیقهی ئیسلامی.',
    books: ['تەفسیری قورئانی بەرز و بەپێز', 'باوەڕ و شوێنەواری', 'پوختەی عەقیدەی ئیسلامی'],
    audioSeriesTitle: 'زنجیرە وانەکانی تەفسیر و بیروباوەڕ'
  },
  {
    id: 'othman_abdulaziz',
    name: 'پێشەوا مامۆستا مەلا عوسمان عەبدولعەزیز',
    title: 'موفەسیر و ڕابەری ناسراوی کوردستان',
    bio: 'زانایەکی گەورەی زانستە شەرعییەکان و خاوەنی تەفسیری ناوداری ڕێبەر بۆ قورئانی پیرۆز.',
    books: ['تەفسیری ڕێبەر بۆ قورئانی پیرۆز', 'شیکردنەوەی مەنهەجی ئیسلام'],
    audioSeriesTitle: 'زنجیرەی دەنگیی تەفسیری ڕێبەر و ئوسوڵی فیقهـ'
  },
  {
    id: 'krekar',
    name: 'مامۆستا کرێکار (نەجمەدین فەرەج)',
    title: 'نووسەر و لێکۆڵەری ئیسلامی',
    bio: 'شارەزای زانستەکانی حەدیس، عەقیدە و مێژووی ئیسلامی.',
    books: ['شیکردنەوەی عەقیدەی تەحاوی', 'وانەکانی فیقهـ و تەوحید', 'سیرەی پێغەمبەر ﷺ'],
    audioSeriesTitle: 'زنجیرە وانە زانستییەکانی عەقیدە و فەرموودەناسی'
  },
  {
    id: 'othman_khamis',
    name: 'د. عوسمان خەمیس (د. عثمان الخميس)',
    title: 'گەورە زانای ناوداری جیهانی ئیسلامی',
    bio: 'دکتۆرا لە زانستە شەرعییەکان و خاوەنی سەدان وتار لە شیکردنەوەی سوننەت.',
    books: ['فەقهی پەرستشەکان', 'ڕوونکردنەوەی حوکمە شەرعییەکان'],
    audioSeriesTitle: 'شیکردنەوەی فەرموودە، سیرە و بەڵگە فیقهییەکان'
  }
];

export const LibraryView: React.FC = () => {
  const [selectedScholar, setSelectedScholar] = useState(SCHOLARS_LIST[0]);

  return (
    <div className="space-y-4 max-w-xl mx-auto p-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-amber-900">کتێبخانەی زانستیی شەرعی</h2>
        <p className="text-xs text-slate-500">کتێب و وانە دەنگییەکانی گەورە زانایانی کورد و عەرەب</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {SCHOLARS_LIST.map(scholar => (
          <div 
            key={scholar.id} 
            onClick={() => setSelectedScholar(scholar)}
            className={`p-4 rounded-3xl border cursor-pointer transition-all space-y-2.5 bg-white shadow-xs ${
              selectedScholar.id === scholar.id 
                ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50/20' 
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-base border border-amber-200">
                {scholar.name[0]}
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-900">{scholar.name}</h3>
                <p className="text-[10px] text-slate-500">{scholar.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
              {scholar.bio}
            </p>

            <div className="text-xs text-slate-700 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <strong className="text-amber-800 block mb-1 text-[11px]">کتێبە سەرەکییەکان:</strong>
              {scholar.books.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                  <BookMarked className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-teal-800 bg-teal-50 p-2.5 rounded-2xl border border-teal-100 flex items-center gap-2">
              <Volume2 className="w-4 h-4 shrink-0 text-teal-700" />
              <span>{scholar.audioSeriesTitle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
