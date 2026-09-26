import React, { useState } from 'react';
import { Search, X, Check, BookOpen, Globe, BookMarked } from 'lucide-react';
import { ALL_TAFSIRS_DIRECTORY, TafsirItem } from '../data/tafsirList';

interface TafsirSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTafsirId: string;
  onSelectTafsir: (tafsir: TafsirItem) => void;
}

export const TafsirSelectorModal: React.FC<TafsirSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedTafsirId,
  onSelectTafsir
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'kurdish' | 'arabic' | 'english' | 'persian' | 'global'>('all');

  if (!isOpen) return null;

  const filteredTafsirs = ALL_TAFSIRS_DIRECTORY.filter(t => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.language.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs p-3 sm:p-4 flex items-end sm:items-center justify-center animate-in fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 max-h-[85vh] flex flex-col shadow-2xl text-slate-900" dir="rtl">
        
        {/* سەرپەڕە */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">هەڵبژاردنی تەفسیر و وەرگێڕان</h3>
              <p className="text-[10px] text-slate-500">٥٠+ تەفسیری کوردی، عەرەبی و جیهانی</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* سێرچی خێرا */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="گەڕان لە ناوی تەفسیر یان نووسەر (نامی، عەلی باپیر، ابن كثير)..."
            className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs px-3.5 py-3 pr-9 rounded-2xl border border-slate-200 focus:outline-none focus:border-amber-600 shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
        </div>

        {/* تابی زمانەکان */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
          {[
            { id: 'all', label: 'هەمووی' },
            { id: 'kurdish', label: 'کوردی 🟢' },
            { id: 'arabic', label: 'العربية 🟡' },
            { id: 'english', label: 'English 🔵' },
            { id: 'persian', label: 'فارسی 🟣' },
            { id: 'global', label: 'زمانەکان 🌐' }
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                activeCategory === c.id 
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* لیستی تەفسیرەکان */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[50vh]">
          {filteredTafsirs.map((tafsir) => {
            const isSelected = selectedTafsirId === tafsir.id;
            return (
              <div
                key={tafsir.id}
                onClick={() => {
                  onSelectTafsir(tafsir);
                  onClose();
                }}
                className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all active:scale-[0.99] ${
                  isSelected 
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    <BookMarked className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{tafsir.title}</h4>
                    <p className="text-[10px] text-slate-500">{tafsir.author} • <span className="text-amber-800 font-medium">{tafsir.language}</span></p>
                  </div>
                </div>

                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
