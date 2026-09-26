import React, { useState } from 'react';
import { 
  ArrowRight, Palette, Globe, Eye, Sliders, Volume2, 
  BookOpen, Type, Sparkles, Smartphone, Moon, Sun, Bell, Check
} from 'lucide-react';
import { BgThemeType, AppLangType, AccentColorType } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  bgStyle: BgThemeType;
  setBgStyle: (val: BgThemeType) => void;
  appLang: AppLangType;
  setAppLang: (val: AppLangType) => void;
  accentColor: AccentColorType;
  setAccentColor: (val: AccentColorType) => void;
  showKurdishNames: boolean;
  setShowKurdishNames: (val: boolean) => void;
  showNumbers: boolean;
  setShowNumbers: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  bgStyle,
  setBgStyle,
  appLang,
  setAppLang,
  accentColor,
  setAccentColor,
  showKurdishNames,
  setShowKurdishNames,
  showNumbers,
  setShowNumbers
}) => {
  const [activeTab, setActiveTab] = useState<'display' | 'reading' | 'translation' | 'audio'>('display');

  // خوێندنەوە
  const [showPageInfo, setShowPageInfo] = useState(true);
  const [notifyJuz, setNotifyJuz] = useState(true);
  const [highlightBookmarks, setHighlightBookmarks] = useState(true);
  const [useVolumeKeys, setUseVolumeKeys] = useState(false);
  const [lockOrientation, setLockOrientation] = useState(false);
  
  // دەق و تەفسیر
  const [verseAboveTranslation, setVerseAboveTranslation] = useState(true);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [arabicFontSize, setArabicFontSize] = useState(26);
  const [translationFontSize, setTranslationFontSize] = useState(15);
  const [nightBrightness, setNightBrightness] = useState(220);

  // دەنگ
  const [onlineStream, setOnlineStream] = useState(true);
  const [audioQuality, setAudioQuality] = useState<'high' | 'standard'>('high');

  return (
    <div className="max-w-xl mx-auto p-3 sm:p-4 space-y-4 select-none pb-12">
      
      {/* سەرپەڕە */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-3.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              {appLang === 'ar' ? 'الإعدادات' : (appLang === 'en' ? 'Settings' : 'ڕێکخستنەکان')}
            </h2>
            <p className="text-[10px] text-slate-500">کۆنتڕۆڵی تەواوی قورئان و دیزاین</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>گەڕانەوە</span>
        </button>
      </div>

      {/* ٤ تابی ڕێکخراوی ڕێکخستنەکان */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-xs">
        {[
          { id: 'display', label: 'ڕووکار', icon: Palette },
          { id: 'reading', label: 'خوێندنەوە', icon: BookOpen },
          { id: 'translation', label: 'دەق و مانا', icon: Type },
          { id: 'audio', label: 'دەنگ', icon: Volume2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                isActive ? 'bg-white text-amber-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ١. ڕووکار و پیشاندان (Display & Appearance) */}
      {/* ========================================================================= */}
      {activeTab === 'display' && (
        <div className="space-y-3 animate-in fade-in">
          {/* باکگراوند */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 shadow-xs">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-amber-600" />
              شێوازی باکگراوندی قورئان:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'white', label: 'سپیی بەفری ⚪', desc: 'خاوێن و ڕۆشن' },
                { id: 'cream', label: 'کاغەزی شاموا 📜', desc: 'موسحەفی مەدینە' },
                { id: 'dark', label: 'شەوی تاریک 🖤', desc: 'ماتی ئارام' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setBgStyle(st.id as BgThemeType)}
                  className={`p-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                    bgStyle === st.id ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* زمان */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 shadow-xs">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-amber-600" />
              زمانی بەرنامە (Language):
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ku', label: 'کوردی' },
                { id: 'ar', label: 'العربية' },
                { id: 'en', label: 'English' }
              ].map(lg => (
                <button
                  key={lg.id}
                  onClick={() => setAppLang(lg.id as AppLangType)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    appLang === lg.id ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {lg.label}
                </button>
              ))}
            </div>
          </div>

          {/* قوفڵکردنی ئاڕاستەی شاشە */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">قوفڵکردنی ئاڕاستەی شاشە</span>
              <span className="text-[10px] text-slate-500">ڕاگرتنی شاشە لەسەر شێوازی ئێستا (ستوونی)</span>
            </div>
            <input
              type="checkbox"
              checked={lockOrientation}
              onChange={(e) => setLockOrientation(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* درەوشانەوەی دەق لە شەودا */}
          {bgStyle === 'dark' && (
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-xs">
              <div className="flex justify-between text-xs font-bold text-slate-900">
                <span>ڕووناکی نووسین لە دۆخی شەودا:</span>
                <span>{nightBrightness}</span>
              </div>
              <input
                type="range" min="150" max="255" value={nightBrightness}
                onChange={(e) => setNightBrightness(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ٢. شێوازی خوێندنەوە و لاپەڕەکان (Reading Settings) */}
      {/* ========================================================================= */}
      {activeTab === 'reading' && (
        <div className="space-y-3 animate-in fade-in">
          {/* پیشاندانی زانیاریی لاپەڕە */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">پیشاندانی زانیاریی پەڕە</span>
              <span className="text-[10px] text-slate-500">ژمارەی پەڕە، ناوی سوورەت و ژمارەی جوزء</span>
            </div>
            <input
              type="checkbox"
              checked={showPageInfo}
              onChange={(e) => setShowPageInfo(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* ئاگادارکردنەوە لە بەشەکان */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">ئاگادارکردنەوە لە بەشەکان</span>
              <span className="text-[10px] text-slate-500">ئاگادارکردنەوە لەکاتی گەیشتن بە جوزء یان چارەک</span>
            </div>
            <input
              type="checkbox"
              checked={notifyJuz}
              onChange={(e) => setNotifyJuz(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* هایلایتکردنی ئایەتە نیشانکراوەکان */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">نیشانەکان هایلایت بکە</span>
              <span className="text-[10px] text-slate-500">ڕەنگکردنی ئایەتە نیشانکراوەکان لەکاتی خوێندنەوەدا</span>
            </div>
            <input
              type="checkbox"
              checked={highlightBookmarks}
              onChange={(e) => setHighlightBookmarks(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* گۆڕینی پەڕە بە دوگمەی دەنگی مۆبایل */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">فەرمانی دوگمەی دەنگی مۆبایل</span>
              <span className="text-[10px] text-slate-500">هەڵدانەوەی لاپەڕە بە دوگمەکانی بەرز و نزمی دەنگ</span>
            </div>
            <input
              type="checkbox"
              checked={useVolumeKeys}
              onChange={(e) => setUseVolumeKeys(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ٣. دەق و وەرگێڕانەکان (Typography & Translations) */}
      {/* ========================================================================= */}
      {activeTab === 'translation' && (
        <div className="space-y-3 animate-in fade-in">
          {/* ئایەت پێش وەرگێڕان */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">ئایەت پێش وەرگێڕان</span>
              <span className="text-[10px] text-slate-500">پیشاندانی ئایەت بە عەرەبی لەسەرووی وەرگێڕان</span>
            </div>
            <input
              type="checkbox"
              checked={verseAboveTranslation}
              onChange={(e) => setVerseAboveTranslation(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* فۆنتی ئاسانکاریی خوێندنەوە (Dyslexia Friendly) */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Dyslexia friendly font</span>
              <span className="text-[10px] text-slate-500">پیشاندانی وەرگێڕان بە فۆنتی ئاسانکاریی خوێندنەوە</span>
            </div>
            <input
              type="checkbox"
              checked={dyslexiaFont}
              onChange={(e) => setDyslexiaFont(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* قەبارەی نووسینی قورئان */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-xs">
            <div className="flex justify-between text-xs font-bold text-slate-900">
              <span>قەبارەی نووسینی قورئان:</span>
              <span className="text-amber-800">{arabicFontSize}px</span>
            </div>
            <input
              type="range" min="20" max="38" value={arabicFontSize}
              onChange={(e) => setArabicFontSize(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>

          {/* قەبارەی نووسینی وەرگێڕان */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-xs">
            <div className="flex justify-between text-xs font-bold text-slate-900">
              <span>قەبارەی نووسینی وەرگێڕان و تەفسیر:</span>
              <span className="text-amber-800">{translationFontSize}px</span>
            </div>
            <input
              type="range" min="12" max="22" value={translationFontSize}
              onChange={(e) => setTranslationFontSize(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ٤. دەنگ و داگرتن (Audio & Stream) */}
      {/* ========================================================================= */}
      {activeTab === 'audio' && (
        <div className="space-y-3 animate-in fade-in">
          {/* شەپۆلی دەنگی سەرهێڵ */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold text-slate-900 block">شەپۆلی دەنگی سەرهێڵ (Online Streaming)</span>
              <span className="text-[10px] text-slate-500">لێدانی دەنگ لەڕێی ئینتەرنێتەوە لەکاتی شیاودا</span>
            </div>
            <input
              type="checkbox"
              checked={onlineStream}
              onChange={(e) => setOnlineStream(e.target.checked)}
              className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
            />
          </div>

          {/* کوالیتیی دەنگ */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 shadow-xs">
            <span className="text-xs font-bold text-slate-900 block">کوالیتیی دەنگی قورئانخوێن:</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'high', label: 'کوالیتیی بەرز (128 kbps)' },
                { id: 'standard', label: 'کوالیتیی کەم (بۆ نێتی خاو)' }
              ].map(q => (
                <button
                  key={q.id}
                  onClick={() => setAudioQuality(q.id as any)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    audioQuality === q.id ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
