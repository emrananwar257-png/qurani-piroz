import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, Loader2, BookOpen, Play, Pause, 
  Bookmark, BookmarkCheck, Globe, Share2, X
} from 'lucide-react';
import { BgThemeType, AppLangType, SurahItem } from '../types';
import { ALL_RECITERS_DIRECTORY, ReciterItem } from '../data/recitersList';
import { ALL_TAFSIRS_DIRECTORY, TafsirItem } from '../data/tafsirList';
import { RecitersModal } from './RecitersModal';
import { TafsirSelectorModal } from './TafsirSelectorModal';

interface MushafPageViewProps {
  currentPage: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onBackToIndex: () => void;
  bgStyle: BgThemeType;
  appLang: AppLangType;
  showNumbers: boolean;
  surahsList?: SurahItem[];
  onJumpToPage?: (page: number) => void;
}

const formatPageNum = (n: number) => String(n).padStart(3, '0');
const pageImgUrl = (n: number) => `https://android.quran.com/data/width_1260/page${formatPageNum(n)}.png`;

const AYAH_CANVAS_WIDTH = 1260;
const AYAH_CANVAS_HEIGHT = 2020;

type AyahBoxObj = { s: number; a: number; l: number; x0: number; x1: number; y0: number; y1: number };

const LONG_PRESS_MS = 550;

export const MushafPageView: React.FC<MushafPageViewProps> = ({
  currentPage,
  onNextPage,
  onPrevPage,
  onBackToIndex,
  bgStyle,
  appLang,
  showNumbers,
  surahsList = [],
  onJumpToPage
}) => {
  const [viewMode, setViewMode] = useState<'mushaf' | 'tafsir'>('mushaf');
  const [showControls, setShowControls] = useState(true);

  const [isRecitersModalOpen, setIsRecitersModalOpen] = useState(false);
  const [isTafsirSelectorOpen, setIsTafsirSelectorOpen] = useState(false);

  const [selectedReciter, setSelectedReciter] = useState<ReciterItem>(ALL_RECITERS_DIRECTORY[18] || ALL_RECITERS_DIRECTORY[0]);
  const [selectedTafsir, setSelectedTafsir] = useState<TafsirItem>(ALL_TAFSIRS_DIRECTORY[0]);

  const [pageAyahsData, setPageAyahsData] = useState<any[]>([]);
  const [loadingTafsir, setLoadingTafsir] = useState(false);
  const [ayahApiError, setAyahApiError] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('quran_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [pressingBox, setPressingBox] = useState<string | null>(null);
  const [highlightedAyah, setHighlightedAyah] = useState<{ ayah: any; topPercent: number } | null>(null);
  const [tafsirSheetOpen, setTafsirSheetOpen] = useState(false);
  const [playingAyahKey, setPlayingAyahKey] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [allAyahData, setAllAyahData] = useState<Record<string, AyahBoxObj[]>>({});
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}ayahdata/ayahdata.json`)
      .then(res => res.json())
      .then(data => setAllAyahData(data))
      .catch(() => setAllAyahData({}));
  }, []);

  const ayahBoxes: AyahBoxObj[] = allAyahData[String(currentPage)] || [];

  const [ayahBookmarks, setAyahBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quran_ayah_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const ayahKey = (a: any) => `${a.surahNumber}:${a.numberInSurah}`;
  const isAyahBookmarked = (a: any) => ayahBookmarks.includes(ayahKey(a));

  const toggleAyahBookmark = (a: any) => {
    const key = ayahKey(a);
    const updated = isAyahBookmarked(a)
      ? ayahBookmarks.filter(k => k !== key)
      : [...ayahBookmarks, key];
    setAyahBookmarks(updated);
    localStorage.setItem('quran_ayah_bookmarks', JSON.stringify(updated));
    if (navigator.vibrate) navigator.vibrate(35);
  };

  const playAyahAudio = (a: any) => {
    const key = ayahKey(a);
    if (playingAyahKey === key) {
      audioRef.current?.pause();
      setPlayingAyahKey(null);
      return;
    }
    const surahPadded = String(a.surahNumber).padStart(3, '0');
    const ayahPadded = String(a.numberInSurah).padStart(3, '0');
    if (audioRef.current) {
      audioRef.current.src = `https://everyayah.com/data/${selectedReciter.serverKey}/${surahPadded}${ayahPadded}.mp3`;
      audioRef.current.play().catch(() => setPlayingAyahKey(null));
      setPlayingAyahKey(key);
      setIsPlayingAudio(false);
    }
  };

  const shareAyah = async (a: any) => {
    const activeTafsirText = pageAyahsData.find(x => x.surahNumber === a.surahNumber && x.numberInSurah === a.numberInSurah)?.tafsir || a.tafsir;
    const text = `${a.arabic}\n\n(${a.surahNumber}:${a.numberInSurah})\n\n${activeTafsirText}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {}
  };

  const startLongPress = (boxKey: string, ayah: any, topPercent: number) => {
    setPressingBox(boxKey);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setHighlightedAyah({ ayah, topPercent });
      setPressingBox(null);
      setTafsirSheetOpen(false);
      if (navigator.vibrate) navigator.vibrate(40);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressingBox(null);
  };

  const closeHighlight = () => {
    setHighlightedAyah(null);
    setTafsirSheetOpen(false);
  };

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUpdating = useRef(false);

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const isFirstScroll = useRef(true);
  const scrollInitiatedByUser = useRef(false);

  const isBookmarked = bookmarks.includes(currentPage);
  const currentJuz = Math.ceil(currentPage / 20);
  
  const currentSurah = surahsList.slice().reverse().find(s => currentPage >= s.startPage) || surahsList[0];

  const toggleBookmark = () => {
    let updated: number[];
    if (isBookmarked) {
      updated = bookmarks.filter(p => p !== currentPage);
    } else {
      updated = [...bookmarks, currentPage];
    }
    setBookmarks(updated);
    localStorage.setItem('quran_bookmarks', JSON.stringify(updated));
    if (navigator.vibrate) navigator.vibrate(35);
  };

  useEffect(() => {
    closeHighlight();
    cancelLongPress();
  }, [currentPage]);

  // 🎯 بارکردنی دەق و تەفسیری ئایەتەکان بە شێوازی زیرەک و فرە-سێرڤەر
  useEffect(() => {
    let isMounted = true;

    async function loadPageVerses() {
      setLoadingTafsir(true);
      setAyahApiError(null);

      const tafsirKey = (selectedTafsir as any).key || (selectedTafsir as any).identifier || 'ku.asan';

      try {
        // ١. داواکردنی دەقی عەرەبی و تەفسیر لە یەک کاتدا
        const res = await fetch(`https://api.alquran.cloud/v1/page/${currentPage}/editions/quran-uthmani,${tafsirKey}`);
        const data = await res.json();

        if (data.code === 200 && data.data && data.data.length >= 2) {
          const arAyahs = data.data[0].ayahs;
          const tfAyahs = data.data[1].ayahs;

          const combined = arAyahs.map((a: any, i: number) => ({
            surahNumber: a.surah.number,
            numberInSurah: a.numberInSurah,
            arabic: a.text,
            tafsir: tfAyahs[i]?.text || 'تەفسیر لەم بەشەدا بەردەست نییە'
          }));

          if (isMounted) setPageAyahsData(combined);
        } else {
          // ئەگەر هاوبەشەکە سەرکەوتوو نەبوو، بە جیاواز داوایان بکە
          throw new Error("Fallback to separate fetch");
        }
      } catch {
        // Fallback: داواکردنی جیاواز لەگەڵ سەرچاوەی یەدەگی تەفسیری کوردی
        try {
          const resAr = await fetch(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`);
          const dataAr = await resAr.json();

          if (dataAr.code === 200 && dataAr.data) {
            const arAyahs = dataAr.data.ayahs;
            let tfAyahs: any[] = [];

            try {
              const resTf = await fetch(`https://api.alquran.cloud/v1/page/${currentPage}/${tafsirKey}`);
              const dataTf = await resTf.json();
              if (dataTf.code === 200 && dataTf.data) {
                tfAyahs = dataTf.data.ayahs;
              }
            } catch {}

            const combined = arAyahs.map((a: any, i: number) => ({
              surahNumber: a.surah.number,
              numberInSurah: a.numberInSurah,
              arabic: a.text,
              tafsir: tfAyahs[i]?.text || 'تەفسیری ئەم ئایەتە بەردەستە'
            }));

            if (isMounted) setPageAyahsData(combined);
          }
        } catch (err: any) {
          if (isMounted) setAyahApiError(err?.message || 'کێشە لە هێنانی تەفسیر دروستبوو');
        }
      } finally {
        if (isMounted) setLoadingTafsir(false);
      }
    }

    loadPageVerses();

    return () => {
      isMounted = false;
    };
  }, [currentPage, selectedTafsir]);

  useEffect(() => {
    if (scrollInitiatedByUser.current) {
      scrollInitiatedByUser.current = false;
      return;
    }

    const scrollToTarget = () => {
      const el = pageRefs.current[currentPage];
      if (el) {
        isUpdating.current = true;
        el.scrollIntoView({
          behavior: isFirstScroll.current ? 'auto' : 'smooth',
          inline: 'center',
          block: 'nearest',
        });
        isFirstScroll.current = false;
        setTimeout(() => {
          isUpdating.current = false;
        }, 400);
      }
    };

    if (isFirstScroll.current) {
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToTarget();
          setTimeout(() => {
            const el = pageRefs.current[currentPage];
            const container = scrollContainerRef.current;
            if (el && container) {
              const elRect = el.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const isVisible = elRect.left >= containerRect.left - 5 && elRect.right <= containerRect.right + 5;
              if (!isVisible) {
                el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
              }
            }
          }, 250);
        });
      });
      return () => cancelAnimationFrame(raf1);
    } else {
      scrollToTarget();
    }
  }, [currentPage]);

  const togglePageAudio = () => {
    if (isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      if (audioRef.current) {
        audioRef.current.src = `https://everyayah.com/data/${selectedReciter.serverKey}/PageMp3s/Page${formatPageNum(currentPage)}.mp3`;
        audioRef.current.play().catch(() => {
          setIsPlayingAudio(false);
        });
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isUpdating.current) return;
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const pageWidth = target.clientWidth;

    if (pageWidth > 0) {
      const pageIndex = Math.round(scrollLeft / pageWidth);
      const targetPage = 604 - pageIndex;

      if (targetPage >= 1 && targetPage <= 604 && targetPage !== currentPage) {
        isUpdating.current = true;
        scrollInitiatedByUser.current = true;
        if (onJumpToPage) {
          onJumpToPage(targetPage);
        } else if (targetPage > currentPage) {
          onNextPage();
        } else {
          onPrevPage();
        }
        setTimeout(() => {
          isUpdating.current = false;
        }, 300);
      }
    }
  };

  // وەرگرتنی نوێترین تەفسیری ئایەتی هەڵبژێردراو
  const currentHighlightedTafsir = highlightedAyah 
    ? (pageAyahsData.find(x => x.surahNumber === highlightedAyah.ayah.surahNumber && x.numberInSurah === highlightedAyah.ayah.numberInSurah)?.tafsir || highlightedAyah.ayah.tafsir)
    : '';

  return (
    <div className="relative h-screen max-w-lg mx-auto flex flex-col justify-between select-none bg-stone-100 text-slate-900 overflow-hidden" dir="rtl">
      <audio ref={audioRef} onEnded={() => { setIsPlayingAudio(false); setPlayingAyahKey(null); }} />

      <header className={`absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs transition-all duration-300 ${
        showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      }`}>
        <button
          onClick={onBackToIndex}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
          title="گەڕانەوە"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="font-bold text-sm text-slate-800">
            سووڕه‌تی {currentSurah?.nameAr || 'الفاتحة'}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium">
            په‌ڕه‌ی {currentPage} ، جوزئی {currentJuz}
          </p>
        </div>

        <div className="flex items-center gap-1 text-slate-700">
          <button
            onClick={() => setViewMode(prev => prev === 'mushaf' ? 'tafsir' : 'mushaf')}
            className={`p-2 rounded-xl transition-colors ${
              viewMode === 'tafsir' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'hover:bg-slate-100'
            }`}
            title="تەفسیر"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            onClick={toggleBookmark}
            className={`p-2 rounded-xl transition-colors ${
              isBookmarked ? 'text-amber-600' : 'hover:bg-slate-100'
            }`}
            title="نیشانەکردن"
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4 fill-amber-500 text-amber-600" /> : <Bookmark className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsTafsirSelectorOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-700"
            title="تەفسیرەکان"
          >
            <Globe className="w-4 h-4" />
          </button>
        </div>
      </header>

      {viewMode === 'mushaf' && (
        <div 
          className="relative flex-1 flex items-center justify-center bg-stone-200/60 overflow-hidden"
          onClick={() => { setShowControls(prev => !prev); closeHighlight(); }}
        >
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-none items-center"
            style={{ direction: 'ltr' }}
          >
            {Array.from({ length: 604 }, (_, i) => {
              const pageNum = 604 - i;
              const isActivePage = pageNum === currentPage;

              return (
                <div 
                  key={pageNum}
                  ref={(el) => { pageRefs.current[pageNum] = el; }}
                  className="min-w-full h-full flex flex-col items-center justify-center snap-center snap-always p-2 shrink-0"
                  style={{ direction: 'rtl' }}
                >
                  <div
                    className="relative max-h-[76vh]"
                    style={{ aspectRatio: `${AYAH_CANVAS_WIDTH} / ${AYAH_CANVAS_HEIGHT}` }}
                  >
                    <img
                      src={pageImgUrl(pageNum)}
                      alt={`Page ${pageNum}`}
                      loading="lazy"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full h-full max-h-[76vh] object-contain select-none shadow-xl rounded-lg bg-white border border-stone-300"
                      style={{
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                      } as React.CSSProperties}
                    />

                    {isActivePage && ayahApiError && (
                      <div className="absolute top-1 inset-x-0 text-center text-[10px] font-bold bg-red-700/80 text-white py-1 z-50 pointer-events-none">
                        هەڵە: {ayahApiError}
                      </div>
                    )}

                    {isActivePage && ayahBoxes.length > 0 && (
                      <div className="absolute inset-0">
                        {ayahBoxes.map((box, idx) => {
                          const matchedAyah = pageAyahsData.find(
                            (x) => x.surahNumber === box.s && x.numberInSurah === box.a
                          );
                          if (!matchedAyah) return null;

                          const boxKey = `${box.s}-${box.a}-${box.l}-${idx}`;
                          const leftPct = (box.x0 / AYAH_CANVAS_WIDTH) * 100;
                          const widthPct = ((box.x1 - box.x0) / AYAH_CANVAS_WIDTH) * 100;
                          const topPct = (box.y0 / AYAH_CANVAS_HEIGHT) * 100;
                          const heightPct = ((box.y1 - box.y0) / AYAH_CANVAS_HEIGHT) * 100;

                          const isHighlighted = !!highlightedAyah &&
                            highlightedAyah.ayah.surahNumber === box.s &&
                            highlightedAyah.ayah.numberInSurah === box.a;

                          return (
                            <div
                              key={boxKey}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                startLongPress(boxKey, matchedAyah, topPct);
                              }}
                              onPointerUp={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              onContextMenu={(e) => e.preventDefault()}
                              style={{
                                position: 'absolute',
                                left: `${leftPct}%`,
                                top: `${topPct}%`,
                                width: `${widthPct}%`,
                                height: `${heightPct}%`,
                                background: isHighlighted
                                  ? 'rgba(56,189,248,0.35)'
                                  : pressingBox === boxKey
                                  ? 'rgba(56,189,248,0.15)'
                                  : 'transparent',
                                borderRadius: '3px',
                                transition: 'background 0.15s ease',
                              }}
                              className="cursor-pointer touch-none"
                            />
                          );
                        })}
                      </div>
                    )}

                    {isActivePage && highlightedAyah && (
                      <div
                        className="absolute inset-x-0 flex justify-center z-40"
                        style={{ top: `${Math.min(Math.max(highlightedAyah.topPercent - 7, 2), 88)}%` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 bg-emerald-800 text-white rounded-2xl shadow-xl px-1.5 py-1.5">
                          <button
                            onClick={() => playAyahAudio(highlightedAyah.ayah)}
                            className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                            title="گوێگرتن"
                          >
                            {playingAyahKey === ayahKey(highlightedAyah.ayah)
                              ? <Pause className="w-4 h-4" />
                              : <Play className="w-4 h-4 fill-white" />}
                          </button>
                          <button
                            onClick={() => setTafsirSheetOpen(true)}
                            className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                            title="تەفسیر"
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => shareAyah(highlightedAyah.ayah)}
                            className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                            title="ناردن"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleAyahBookmark(highlightedAyah.ayah)}
                            className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                            title="خەزنکردن"
                          >
                            {isAyahBookmarked(highlight
