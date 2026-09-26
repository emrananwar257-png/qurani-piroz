import React, { useState } from 'react';
import { Heart, ShieldCheck } from 'lucide-react';

const SEERAH_CHAPTERS = [
  { id: 1, title: 'لەدایکبوون، نەژاد و منداڵی', era: '٥٧١ ز', summary: 'لەدایکبوونی پیرۆزی پێغەمبەر ﷺ لە مەککە لە ساڵی فیلدا.', content: 'موحەممەدی کوڕی عەبدوڵڵای کوڕی عەبدولموتەلیب لە بەڕێزترین هۆزی قوڕەیش لەدایکبوو. لە منداڵییەوە بە دەستپاکی و ئەمانەت ناوبانگی دەرکرد و بە (الأمين) ناسرا.' },
  { id: 2, title: 'دەستپێکی وەحی لە ئەشکەوتی حەڕا', era: '٦١٠ ز', summary: 'دابەزینی یەکەمین وەحی لە تەمەنی ٤٠ ساڵیدا.', content: 'لە کاتێکدا پێغەمبەر ﷺ لە ئەشکەوتی حەڕا خەریکی پەرستش بوو، جوبرەئیل هاتە خوارەوە بە فەرمانی: (اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ).' },
  { id: 3, title: 'کۆچ بۆ مەدینەی منەوەرە', era: '٦٢٢ ز', summary: 'دامەزراندنی دەوڵەت و برایەتیی نێوان هاوەڵان.', content: 'پاش ١٣ ساڵ ئارامگرتن لەسەر ئازاری موشریکان، پێغەمبەر ﷺ و هاوەڵان کۆچیان کرد بەرەو مەدینە و یەکەم مزگەوتیان بنیاتنا.' },
  { id: 4, title: 'غەزا مەزنەکان و فەتحی مەککە', era: '٢ - ٨ ک', summary: 'بەدر، ئوحود، خەندەق و فەتحی مەزنی مەککە.', content: 'لە ساڵی ٨ی کۆچیدا مەککەی پیرۆز فەتح کرا و پێغەمبەر ﷺ لێبوردەیی گشتیی ڕاگەیاند: (اذهبوا فأنتم الطلقاء).' },
  { id: 5, title: 'حەجی ماڵئاوایی و وەفات', era: '١١ ک', summary: 'تەواوبوونی دین و وەفاتی حەزرەت ﷺ.', content: 'لە حەجی ماڵئاواییدا ئایەتی (الْيَوْمَ أَكْمَلْتُ لَكُمْ دِينَكُمْ) دابەزی و لە ١١ی کۆچی گەیشتە ڕەفیقی ئەعلا.' }
];

const SAHABA_LIST = [
  { name: 'ئەبوبەکری سدیق (ڕەزای خوای لێبێت)', title: 'یەکەمین خەلیفە و هاوەڵی ئەشکەوت', description: 'گەورەترین هاوەڵی پێغەمبەر ﷺ کە هەموو ماڵی لە پێناوی ئیسلامدا بەخشی.' },
  { name: 'عومەری کوڕی خەتتاب (فاروق)', title: 'دووەمین خەلیفە و سیمبولی دادپەروەری', description: 'ئەو هاوەڵەی ئیسلام بە موسڵمانبوونی بەهێز بوو و سنوری دادپەروەریی فراوان کرد.' },
  { name: 'عوسمانی کوڕی عەففان (ذو النورین)', title: 'سێیەمین خەلیفە و کۆکەرەوەی قورئان', description: 'هاوەڵێکی شەرمکەر و بەخشندە کە قورئانی پیرۆزی بۆ هەموو ئوممەت کۆکردەوە.' },
  { name: 'عەلی کوڕی ئەبی تالیب (ڕەزای خوای لێبێت)', title: 'چوارەمین خەلیفە و دەریای زانست', description: 'ئامۆزا و زاوای پێغەمبەر ﷺ و سوارچاکی گۆڕەپانەکان و حیکمەت.' },
  { name: 'خالیدی کوڕی وەلید (شمشێری خودا)', title: 'سەرکردەی بێشکستی جەنگەکان', description: 'سەرکردەیەکی سەربازیی بێوێنە کە لە هیچ جەنگێکدا نەبەزی.' },
  { name: 'خەدیجەی کچی خووەیلید (دایکی باوەڕداران)', title: 'یەکەمین ئیماندار و پشتیوانی پەیامبەر ﷺ', description: 'ئەو خانمە مەزنەی کە لە کاتی تەنگانەدا دڵی پێغەمبەری ئارام کردەوە.' }
];

export const SeerahView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'seerah' | 'sahaba'>('seerah');

  return (
    <div className="space-y-4 max-w-xl mx-auto p-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-amber-900">سیرەی پێغەمبەر ﷺ و هاوەڵان</h2>
        <p className="text-xs text-slate-500">مێژووی زێڕینی ئیسلام بە شێوازی کتێبی دیجیتاڵی</p>
      </div>

      <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
        <button
          onClick={() => setActiveTab('seerah')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'seerah' ? 'bg-white text-amber-900 shadow-sm border border-slate-200' : 'text-slate-500'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>کتێبی سیرەی پێغەمبەر ﷺ</span>
        </button>

        <button
          onClick={() => setActiveTab('sahaba')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'sahaba' ? 'bg-white text-amber-900 shadow-sm border border-slate-200' : 'text-slate-500'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>ئینسایکڵۆپیدیای هاوەڵان</span>
        </button>
      </div>

      {activeTab === 'seerah' && (
        <div className="space-y-3">
          {SEERAH_CHAPTERS.map(ch => (
            <div key={ch.id} className="p-4 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-xs flex items-center justify-center text-amber-900 font-bold">{ch.id}</span>
                  {ch.title}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">{ch.era}</span>
              </div>
              <p className="text-xs text-amber-800 font-bold">{ch.summary}</p>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                {ch.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'sahaba' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SAHABA_LIST.map((s, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs space-y-1 shadow-xs">
              <strong className="text-slate-900 text-xs block font-bold">{s.name}</strong>
              <span className="text-amber-800 font-bold text-[11px] block">{s.title}</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
