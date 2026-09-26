import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  BookOpen,
  Settings as SettingsIcon,
  Loader2,
  Download,
  Check,
  Trash2,
  Pause,
  Play,
  X
} from 'lucide-react';

import {
  SurahItem,
  BgThemeType,
  AppLangType,
  AccentColorType
} from '../types';

import {
  ALL_RECITERS_DIRECTORY,
  ReciterItem
} from '../data/recitersList';

import {
  saveAyahAudio,
  isAyahDownloaded,
  deleteSurahAudio,
  getDownloadedAyahCount
} from '../utils/audioStorage';

interface SurahListViewProps {
  surahs: SurahItem[];
  onOpenSurah: (startPage: number) => void;
  onOpenSettings: () => void;
  bgStyle: BgThemeType;
  appLang: AppLangType;
  accentColor: AccentColorType;
  showKurdishNames: boolean;
  showNumbers: boolean;
}

const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582
];

type CombinedItem =
  | {
      kind: 'juz';
      juzNumber: number;
      page: number;
    }
  | {
      kind: 'surah';
      surah: SurahItem;
    };

interface DownloadState {
  downloaded: number;
  total: number;
  downloading: boolean;
  paused: boolean;
  error?: boolean;
}

const DEFAULT_RECITER =
  ALL_RECITERS_DIRECTORY[18] ||
  ALL_RECITERS_DIRECTORY[0];

/*
 * چاککردنی ڕێڕەوی دەنگی قاریئە کوردییەکان و عەرەبییەکان
 */
const makeAyahUrl = (
  reciter: ReciterItem,
  surahNumber: number,
  ayahNumber: number
) => {
  const surah = String(surahNumber).padStart(3, '0');
  const ayah = String(ayahNumber).padStart(3, '0');

  // ئەگەر قاریئەکە کوردی بوو (بەپێی ID یان ServerKey)
  const isKurdish =
    reciter.id.toLowerCase().includes('kurdish') ||
    reciter.id.toLowerCase().includes('rezgar') ||
    reciter.serverKey.toLowerCase().includes('kurdish') ||
    reciter.serverKey.toLowerCase().includes('rezgar');

  if (isKurdish) {
    // ڕێڕەوی دەنگی قاریئی کوردی
    return `/audio/kurdish/${reciter.serverKey}/${surah}${ayah}.mp3`;
  }

  // بۆ قاریئە عەرەبییەکان
  return `https://everyayah.com/data/${reciter.serverKey}/${surah}${ayah}.mp3`;
};

const KaabaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="6" width="18" height="15" rx="1" fill="#111111" />
    <rect x="3" y="6" width="18" height="4.2" fill="#d4af37" />
    <rect
      x="10.2"
      y="12"
      width="3.6"
      height="9"
      fill="#1a1a1a"
      stroke="#d4af37"
      strokeWidth="0.5"
    />
    <path
      d="M3 6 L12 2 L21 6"
      stroke="#111111"
      strokeWidth="1.2"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const MedinaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="4" y="15" width="16" height="6" rx="0.5" fill="#0f6b4c" />
    <rect x="2" y="19" width="20" height="2" rx="0.5" fill="#0a4a34" />
    <circle cx="12" cy="10.5" r="4" fill="#0f6b4c" />
    <rect x="10.5" y="6" width="3" height="4" fill="#0f6b4c" />
    <circle cx="12" cy="5" r="1" fill="#d4af37" />
    <rect x="4.4" y="9" width="1.6" height="10" fill="#0f6b4c" />
    <rect x="18" y="9" width="1.6" height="10" fill="#0f6b4c" />
    <path
      d="M5.2 9 L5.2 5.5"
      stroke="#0f6b4c"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M18.8 9 L18.8 5.5"
      stroke="#0f6b4c"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="5.2" cy="5" r="0.9" fill="#d4af37" />
    <circle cx="18.8" cy="5" r="0.9" fill="#d4af37" />
  </svg>
);

export const SurahListView: React.FC<SurahListViewProps> = ({
  surahs,
  onOpenSurah,
  onOpenSettings,
  bgStyle,
  appLang,
  accentColor,
  showKurdishNames,
  showNumbers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReciter, setSelectedReciter] = useState<ReciterItem>(DEFAULT_RECITER);
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Record<number, DownloadState>>({});
  const abortControllers = useRef<Record<number, AbortController>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('quran_selected_reciter');
      if (saved) {
        const found = ALL_RECITERS_DIRECTORY.find(r => r.id === saved);
        if (found) setSelectedReciter(found);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleReciterChanged = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const reciterId = customEvent.detail;
      if (!reciterId) return;

      const found = ALL_RECITERS_DIRECTORY.find(r => r.id === reciterId);
      if (found) setSelectedReciter(found);
    };

    window.addEventListener('quran-reciter-changed', handleReciterChanged);
    return () => window.removeEventListener('quran-reciter-changed', handleReciterChanged);
  }, []);

  const selectReciter = (reciter: ReciterItem) => {
    Object.values(abortControllers.current).forEach(controller => controller.abort());
    abortControllers.current = {};

    setSelectedReciter(reciter);
    try {
      localStorage.setItem('quran_selected_reciter', reciter.id);
    } catch {}

    window.dispatchEvent(
      new CustomEvent('quran-reciter-changed', { detail: reciter.id })
    );

    setDownloadStates({});
    setShowReciterPicker(false);
  };

  const combinedList = useMemo<CombinedItem[]>(() => {
    if (searchQuery.trim()) return [];

    const list: CombinedItem[] = [];
    let juzIndex = 0;

    for (const s of surahs) {
      while (
        juzIndex < JUZ_START_PAGES.length &&
        JUZ_START_PAGES[juzIndex] <= s.startPage
      ) {
        list.push({
          kind: 'juz',
          juzNumber: juzIndex + 1,
          page: JUZ_START_PAGES[juzIndex]
        });
        juzIndex++;
      }

      list.push({
        kind: 'surah',
        surah: s
      });
    }

    return list;
  }, [surahs, searchQuery]);

  const [ayahResults, setAyahResults] = useState<any[]>([]);
  const [loadingAyah, setLoadingAyah] = useState(false);
  const [ayahSearchDone, setAyahSearchDone] = useState(false);
  const [ayahSearchEdition, setAyahSearchEdition] = useState<'ar' | 'ku'>('ar');

  useEffect(() => {
    const q = searchQuery.trim();

    if (!q || q.length < 2) {
      setAyahResults([]);
      setAyahSearchDone(false);
      setLoadingAyah(false);
      return;
    }

    const isArabicQuery = /[\u0600-\u06FF]/.test(q) && !/[ئەۆڵگچژڕڤ]/.test(q);
    const edition = isArabicQuery ? 'quran-uthmani' : 'ku.asan';

    setAyahSearchEdition(isArabicQuery ? 'ar' : 'ku');
    setLoadingAyah(true);
    setAyahSearchDone(false);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.alquran.cloud/v1/search/${encodeURIComponent(q)}/all/${edition}`
        );
        const data = await res.json();

        if (data.code === 200 && data.data?.matches) {
          setAyahResults(data.data.matches.slice(0, 40));
        } else {
          setAyahResults([]);
        }
      } catch {
        setAyahResults([]);
      } finally {
        setLoadingAyah(false);
        setAyahSearchDone(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openAyahResult = async (match: any) => {
    if (match.page) {
      onOpenSurah(match.page);
      return;
    }

    try {
      const edition = ayahSearchEdition === 'ku' ? 'ku.asan' : 'quran-uthmani';
      const res = await fetch(
        `https://api.alquran.cloud/v1/ayah/${match.surah.number}:${match.numberInSurah}/${edition}`
      );
      const data = await res.json();

      if (data.code === 200 && data.data?.page) {
        onOpenSurah(data.data.page);
      }
    } catch {}
  };

  const getCardStyle = () => {
    if (bgStyle === 'cream') {
      return 'bg-[#fcfaf5] border-[#ebdcb9] hover:bg-[#f4ebd8] text-[#3c2d15]';
    }
    if (bgStyle === 'dark') {
      return 'bg-[#121722] border-slate-800 hover:bg-[#181f2e] text-slate-100';
    }
    return 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900 shadow-xs';
  };

  const getAccentText = () => {
    if (accentColor === 'emerald') return 'text-emerald-700';
    if (accentColor === 'blue') return 'text-blue-700';
    return 'text-[#854d0e]';
  };

  const refreshDownloadState = async (surah: SurahItem) => {
    try {
      const downloaded = await getDownloadedAyahCount(
        selectedReciter.id,
        surah.number,
        surah.ayahs
      );

      setDownloadStates(prev => ({
        ...prev,
        [surah.number]: {
          downloaded,
          total: surah.ayahs,
          downloading: prev[surah.number]?.downloading ?? false,
          paused: prev[surah.number]?.paused ?? false,
          error: prev[surah.number]?.error ?? false
        }
      }));
    } catch {}
  };

  useEffect(() => {
    const loadStates = async () => {
      for (const surah of surahs) {
        await refreshDownloadState(surah);
      }
    };
    loadStates();
  }, [surahs, selectedReciter]);

  const resetDownloadState = (surah: SurahItem) => {
    setDownloadStates(prev => ({
      ...prev,
      [surah.number]: {
        downloaded: 0,
        total: surah.ayahs,
        downloading: false,
        paused: false,
        error: false
      }
    }));
  };

  const downloadSurah = async (surah: SurahItem) => {
    if (downloadStates[surah.number]?.downloading) return;

    const reciterAtStart = selectedReciter;
    const controller = new AbortController();
    abortControllers.current[surah.number] = controller;

    try {
      const existing = await getDownloadedAyahCount(
        reciterAtStart.id,
        surah.number,
        surah.ayahs
      );

      setDownloadStates(prev => ({
        ...prev,
        [surah.number]: {
          downloaded: existing,
          total: surah.ayahs,
          downloading: true,
          paused: false,
          error: false
        }
      }));

      let currentCount = existing;

      for (let ayah = 1; ayah <= surah.ayahs; ayah++) {
        if (controller.signal.aborted) break;

        const already = await isAyahDownloaded(
          reciterAtStart.id,
          surah.number,
          ayah
        );

        if (already) continue;

        const url = makeAyahUrl(reciterAtStart, surah.number, ayah);
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        await saveAyahAudio(reciterAtStart.id, surah.number, ayah, blob);

        currentCount++;
        setDownloadStates(prev => ({
          ...prev,
          [surah.number]: {
            downloaded: currentCount,
            total: surah.ayahs,
            downloading: true,
            paused: false,
            error: false
          }
        }));
      }

      const finalCount = await getDownloadedAyahCount(
        reciterAtStart.id,
        surah.number,
        surah.ayahs
      );

      if (selectedReciter.id === reciterAtStart.id) {
        setDownloadStates(prev => ({
          ...prev,
          [surah.number]: {
            downloaded: finalCount,
            total: surah.ayahs,
            downloading: false,
            paused: false,
            error: false
          }
        }));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        const current = await getDownloadedAyahCount(
          reciterAtStart.id,
          surah.number,
          surah.ayahs
        ).catch(() => 0);

        if (selectedReciter.id === reciterAtStart.id) {
          setDownloadStates(prev => ({
            ...prev,
            [surah.number]: {
              downloaded: current,
              total: surah.ayahs,
              downloading: false,
              paused: true,
              error: false
            }
          }));
        }
      } else {
        console.error('Audio download error:', error);
        const current = await getDownloadedAyahCount(
          reciterAtStart.id,
          surah.number,
          surah.ayahs
        ).catch(() => 0);

        if (selectedReciter.id === reciterAtStart.id) {
          setDownloadStates(prev => ({
            ...prev,
            [surah.number]: {
              downloaded: current,
              total: surah.ayahs,
              downloading: false,
              paused: false,
              error: true
            }
          }));

          alert(
            'دابەزاندنی دەنگ سەرکەوتوو نەبوو.\n\nئەگەر ئینتەرنێتەکەت باشە، ئەوا لەوانەیە سەرچاوەی دەنگ ڕێگەی دابەزاندنی ڕاستەوخۆ نەدات.'
          );
        }
      }
    } finally {
      if (abortControllers.current[surah.number] === controller) {
        delete abortControllers.current[surah.number];
      }
    }
  };

  const pauseDownload = (surahNumber: number) => {
    const controller = abortControllers.current[surahNumber];
    if (controller) controller.abort();
  };

  const removeSurahAudio = async (surah: SurahItem) => {
    const state = downloadStates[surah.number];
    if (!state || state.downloaded === 0) return;

    const confirmed = window.confirm(
      appLang === 'ar'
        ? 'هل تريد حذف صوت هذه السورة؟'
        : appLang === 'en'
          ? 'Delete downloaded audio for this surah?'
          : 'دڵنیایت دەتەوێت دەنگی ئەم سورەتە بسڕیتەوە؟'
    );

    if (!confirmed) return;

    try {
      await deleteSurahAudio(selectedReciter.id, surah.number, surah.ayahs);
      resetDownloadState(surah);
    } catch (error) {
      console.error('Delete audio error:', error);
      alert('سڕینەوەی دەنگ سەرکەوتوو نەبوو.');
    }
  };

  const renderDownloadButton = (surah: SurahItem) => {
    const state = downloadStates[surah.number] || {
      downloaded: 0,
      total: surah.ayahs,
      downloading: false,
      paused: false,
      error: false
    };

    const isComplete = state.downloaded >= state.total;
    const progress =
      state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;

    if (state.downloading) {
      return (
        <div className="w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                pauseDownload(surah.number);
              }}
              className="flex-1 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
            >
              <Pause className="w-4 h-4" />
              <span className="text-xs font-bold">وەستاندن</span>
            </button>
            <div className="px-3 text-center">
              <div className="text-xs font-bold text-amber-700">{progress}%</div>
              <div className="text-[9px] text-slate-500">
                {state.downloaded}/{state.total}
              </div>
            </div>
          </div>
          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    }

    if (isComplete) {
      return (
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span className="text-xs font-bold">دەنگ دابەزێندراوە</span>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              removeSurahAudio(surah);
            }}
            className="h-11 px-4 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[10px] font-bold">سڕینەوە</span>
          </button>
        </div>
      );
    }

    if (state.downloaded > 0) {
      return (
        <div className="w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                downloadSurah(surah);
              }}
              className="flex-1 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
            >
              <Play className="w-4 h-4" />
              <span className="text-xs font-bold">بەردەوامکردنی دابەزاندن</span>
            </button>
            <div className="text-center px-2">
              <div className="text-xs font-bold text-blue-700">{progress}%</div>
              <div className="text-[9px] text-slate-500">
                {state.downloaded}/{state.total}
              </div>
            </div>
          </div>
          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          downloadSurah(surah);
        }}
        className="w-full h-11 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
      >
        <Download className="w-5 h-5" />
        <span className="text-xs font-bold">دابەزاندنی دەنگی سورەت</span>
      </button>
    );
  };

  const renderSurahCard = (surah: SurahItem) => {
    const isMeccan = surah.typeKu === 'مەککەیی';
    const state = downloadStates[surah.number];
    const progress =
      state && state.total > 0
        ? Math.round((state.downloaded / state.total) * 100)
        : 0;

    return (
      <div
        key={surah.number}
        onClick={() => onOpenSurah(surah.startPage)}
        className={`p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] ${getCardStyle()}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {showNumbers && (
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
              {surah.number}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm truncate">سورة {surah.nameAr}</h3>

            <p className="text-[11px] opacity-75 flex items-center gap-1 flex-wrap mt-1">
              {showKurdishNames && (
                <span>
                  {appLang === 'en' ? surah.nameEn : surah.nameKu}
                  {' • '}
                </span>
              )}

              <span className="flex items-center gap-1">
                {isMeccan ? (
                  <KaabaIcon className="w-4 h-4 shrink-0" />
                ) : (
                  <MedinaIcon className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {appLang === 'ar'
                    ? surah.typeAr
                    : appLang === 'en'
                      ? surah.typeEn
                      : surah.typeKu}
                </span>
              </span>

              <span>
                • {surah.ayahs}{' '}
                {appLang === 'ar'
                  ? 'آيات'
                  : appLang === 'en'
                    ? 'verses'
                    : 'ئایەت'}
              </span>

              {showNumbers && (
                <span>
                  •{' '}
                  {appLang === 'en'
                    ? `Page ${surah.startPage}`
                    : `لاپەڕەی ${surah.startPage}`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div
          className="mt-3 pt-3 border-t border-slate-200/70"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <span className="text-sm">🎧</span>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-700">دەنگی سورەت</p>
              <p className="text-[8px] text-slate-400 truncate">
                {selectedReciter.name}
              </p>
            </div>
          </div>

          {renderDownloadButton(surah)}

          {state && state.downloaded > 0 && state.downloaded < state.total && (
            <div className="mt-2 flex items-center justify-between text-[8px] text-slate-500">
              <span>
                دابەزێندراوە: {state.downloaded}/{state.total}
              </span>
              <span>{progress}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderJuzHeader = (juzNumber: number, page: number) => (
    <div
      key={`juz-${juzNumber}`}
      className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between"
    >
      <span className="text-[11px] font-bold text-slate-500">
        {appLang === 'ar'
          ? `صفحة ${page}`
          : appLang === 'en'
            ? `Page ${page}`
            : `لاپەڕەی ${page}`}
      </span>

      <span className="text-xs font-bold text-slate-700">
        {appLang === 'ar'
          ? `الجزء ${juzNumber}`
          : appLang === 'en'
            ? `Juz ${juzNumber}`
            : `جوزئی ${juzNumber}`}
      </span>
    </div>
  );

  const showingSearch = searchQuery.trim().length >= 2;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-center pt-2">
        <div className="flex items-center gap-2">
          <BookOpen className={`w-6 h-6 ${getAccentText()}`} />
          <h1
            className={`text-xl sm:text-2xl font-bold font-serif ${getAccentText()}`}
          >
            {appLang === 'ku' && 'قورئانی پیرۆز'}
            {appLang === 'ar' && 'القرآن الكريم'}
            {appLang === 'en' && 'The Noble Quran'}
          </h1>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] text-slate-400 mb-0.5">قاریی دەنگ</p>
            <p className="text-xs font-bold text-slate-800 truncate">
              {selectedReciter.name}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowReciterPicker(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 shrink-0"
          >
            گۆڕینی قاری
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              appLang === 'ku'
                ? 'گەڕان بۆ دەقی ئایەت...'
                : appLang === 'ar'
                  ? 'بحث عن نص آية...'
                  : 'Search verse text...'
            }
            className="w-full text-xs px-3 py-2.5 pr-9 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 shadow-xs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-all shrink-0"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 pt-1">
        {!showingSearch &&
          combinedList.map(item =>
            item.kind === 'juz'
              ? renderJuzHeader(item.juzNumber, item.page)
              : renderSurahCard(item.surah)
          )}

        {showingSearch && (
          <div className="space-y-2">
            {loadingAyah && (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>گەڕان بۆ ئایەتەکان...</span>
              </div>
            )}

            {!loadingAyah && ayahSearchDone && ayahResults.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                هیچ ئایەتێک نەدۆزرایەوە
              </div>
            )}

            {!loadingAyah &&
              ayahResults.map((match, idx) => (
                <div
                  key={`${match.number}-${idx}`}
                  onClick={() => openAyahResult(match)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] ${getCardStyle()}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600">
                      سورة {match.surah?.name || match.surah?.englishName} •{' '}
                      {match.numberInSurah}
                    </span>
                  </div>

                  <p
                    className={`text-sm leading-relaxed text-right ${
                      ayahSearchEdition === 'ar' ? 'font-quran text-base' : ''
                    }`}
                  >
                    {match.text}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>

      {showReciterPicker && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center p-3"
          onClick={() => setShowReciterPicker(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl max-h-[80vh] overflow-hidden bg-white rounded-3xl shadow-2xl"
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm text-slate-800">
                  هەڵبژاردنی قاری
                </h2>
                <p className="text-[10px] text-slate-400 mt-1">
                  دەنگی دابەزێنراو بەپێی ئەم قارییە هەڵدەگیرێت
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowReciterPicker(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-2 max-h-[65vh]">
              {ALL_RECITERS_DIRECTORY.map(reciter => (
                <button
                  type="button"
                  key={reciter.id}
                  onClick={() => selectReciter(reciter)}
                  className={`w-full text-right p-3 rounded-2xl border transition-all ${
                    selectedReciter.id === reciter.id
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">
                        {reciter.name}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {reciter.riwayah}
                      </p>
                    </div>

                    {selectedReciter.id === reciter.id && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
