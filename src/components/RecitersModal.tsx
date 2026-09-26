import React, { useState } from 'react';
import { Search, X, Check, Volume2, Mic, Radio, BookOpen, Download } from 'lucide-react';
import { ALL_RECITERS_DIRECTORY, ReciterItem } from '../data/recitersList';

interface RecitersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReciterId: string;
  onSelectReciter: (reciter: ReciterItem) => void;
}

export const RecitersModal: React.FC<RecitersModalProps> = ({
  isOpen,
  onClose,
  selectedReciterId,
  onSelectReciter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'kurdish' | 'famous' | 'riwayat' | 'teaching'>('all');

  if (!isOpen) return null;

  const filteredReciters = ALL_RECITERS_DIRECTORY.filter(r => {
    const matchesCategory = activeTab === 'all' || r.category === activeTab || (activeTab === 'kurdish' && r.category === 'kurdish_tafsir');
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.subName && r.subName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          r.riwayah.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs p-3 sm:p-4 flex items-end sm:items-center justify-center animate-in fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 max-h-[85vh] flex flex-col shadow-2xl text-slate-900" dir="rtl">
        
        {/* سەرپەڕە */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">دیاریکردنی قورئانخوێن</h3>
              <p className="text-[10px] text-slate-500">١٢٠+ دەنگی کوردی، جیهانی و ڕیوایەتەکان</p>
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
            placeholder="گەڕان لە ناوی قورئانخوێن یان ڕیوایەت (پێشەوا، عەفاسی، وەرش)..."
            className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs px-3.5 py-3 pr-9 rounded-2xl border border-slate-200 focus:outline-none focus:border-amber-600 shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
        </div>

        {/* تابی پۆلەکان */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
          {[
            { id: 'all', label: 'هەمووی' },
            { id: 'kurdish', label: 'کورد ☀️' },
            { id: 'famous', label: 'بەناوبانگ 👑' },
            { id: 'riwayat', label: 'ڕیوایەتەکان 📜' },
            { id: 'teaching', label: 'فێرکاری 👶' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap border transition-all ${
                activeTab === t.id 
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* لیستی قورئانخوێنان */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[50vh]">
          {filteredReciters.map((reciter) => {
            const isSelected = selectedReciterId === reciter.id;
            return (
              <div
                key={reciter.id}
                onClick={() => {
                  onSelectReciter(reciter);
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
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{reciter.name}</h4>
                    <p className="text-[10px] text-slate-500">{reciter.riwayah}</p>
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
