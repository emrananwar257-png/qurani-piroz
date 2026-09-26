import React, { useState } from 'react';
import { Award, Palmtree } from 'lucide-react';

const QUIZ_LIST = [
  { id: 1, question: 'یەکەمین ئایەت کە بۆ پێغەمبەری خوا ﷺ دابەزی کامە بوو؟', options: ['الفاتحة', 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ', 'المدثر', 'البقرة'], correctIndex: 1, rewardHasanat: 50, rewardText: '٥٠ چاکە + درەختێک لە بەهەشت 🌴' },
  { id: 2, question: 'گەورەترین ئایەت لە قورئانی پیرۆزدا کامەیە؟', options: ['ئایەتی کورسی (البقرة: ٢٥٥)', 'ئایەتی دین (البقرة: ٢٨٢)', 'ئایەتی ئاخر فاتحة', 'ئیخلاس'], correctIndex: 0, rewardHasanat: 50, rewardText: '٥٠ چاکە + پارێزگاری لە شەیتان ✨' },
  { id: 3, question: 'سوورەتی یاسین بە چی ناسراوە بەپێی فەرموودە؟', options: ['دایکی قورئان', 'دڵی قورئان', 'بووکی قورئان', 'کۆتایی قورئان'], correctIndex: 1, rewardHasanat: 50, rewardText: '٥٠ چاکە + لێخۆشبوونی تاوان 🕊️' },
  { id: 4, question: 'نووسەری «تەفسیری نامی» بۆ قورئانی پیرۆز کێیە؟', options: ['مامۆستا عەلی باپیر', 'مامۆستا مەلا عەبدولکەریمی مودەڕڕیس', 'مامۆستا عوسمان عەبدولعەزیز', 'مەلا موحەممەد کۆیی'], correctIndex: 1, rewardHasanat: 50, rewardText: '٥٠ چاکە + دەستخۆشی زانستی 📚' },
  { id: 5, question: 'کام لە هاوەڵان بە (سەیفوڵڵا - شمشێری خودا) ناسراوە؟', options: ['عومەری کوڕی خەتتاب', 'عەلی کوڕی ئەبی تالیب', 'خالیدی کوڕی وەلید', 'سەعدی کوڕی ئەبی وەقاس'], correctIndex: 2, rewardHasanat: 50, rewardText: '٥٠ چاکە + ناسینی پاڵەوانانی ئیسلام ⚔️' }
];

interface QuizViewProps {
  hasanatScore: number;
  onAddHasanat: (amount: number) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  hasanatScore,
  onAddHasanat
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);

  const currentQ = QUIZ_LIST[currentIndex];

  const handleSelectOption = (idx: number) => {
    setSelectedAnswer(idx);
    if (idx === currentQ.correctIndex) {
      onAddHasanat(currentQ.rewardHasanat);
      setShowRewardModal(true);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto p-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-amber-900">ئەکادیمیای تاقیکردنەوە و خەڵات</h2>
        <p className="text-xs text-slate-500">تاقیکردنەوەی زانیارییە شەرعییەکان و بەدەستهێنانی چاکە</p>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            پرسیاری {currentIndex + 1} لە {QUIZ_LIST.length}
          </span>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
            <Palmtree className="w-4 h-4" /> +{currentQ.rewardHasanat} چاکە
          </span>
        </div>

        <h3 className="font-bold text-sm text-slate-900 leading-snug">{currentQ.question}</h3>

        <div className="space-y-2 pt-1">
          {currentQ.options.map((opt, i) => {
            let btnStyle = 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100';
            if (selectedAnswer !== null) {
              if (i === currentQ.correctIndex) btnStyle = 'bg-emerald-600 text-white border-emerald-500 shadow-sm';
              else if (i === selectedAnswer) btnStyle = 'bg-rose-600 text-white border-rose-500';
            }
            return (
              <button
                key={i}
                onClick={() => selectedAnswer === null && handleSelectOption(i)}
                className={`w-full p-3.5 rounded-2xl text-xs font-bold text-right transition-all border ${btnStyle}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && (
          <div className="pt-2">
            <button
              onClick={() => {
                setSelectedAnswer(null);
                if (currentIndex < QUIZ_LIST.length - 1) setCurrentIndex(prev => prev + 1);
                else setCurrentIndex(0);
              }}
              className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md"
            >
              پرسیاری دواتر ⬅️
            </button>
          </div>
        )}
      </div>

      {showRewardModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-center space-y-3.5 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center mx-auto">
              <Palmtree className="w-7 h-7 animate-bounce" />
            </div>
            <h3 className="font-bold text-base text-slate-900">پیرۆزە! وەڵامەکەت دروست بوو 🎉</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{currentQ.rewardText}</p>
            <button
              onClick={() => setShowRewardModal(false)}
              className="w-full py-3 rounded-2xl bg-amber-600 text-white font-bold text-xs shadow-md"
            >
              وەرگرتنی پاداشت و بەردەوامبوون
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
