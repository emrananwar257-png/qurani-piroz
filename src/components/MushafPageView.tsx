import React, {
  useState,
  useEffect,
  useRef
} from 'react';

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

import {
  ArrowRight,
  Loader2,
  BookOpen,
  Play,
  Pause,
  Bookmark,
  BookmarkCheck,
  Globe,
  Share2,
  X,
  Download,
  Check,
  Trash2
} from 'lucide-react';

import {
  BgThemeType,
  AppLangType,
  SurahItem
} from '../types';

import {
  ALL_RECITERS_DIRECTORY,
  ReciterItem
} from '../data/recitersList';

import {
  ALL_TAFSIRS_DIRECTORY,
  TafsirItem
} from '../data/tafsirList';

import { RecitersModal } from './RecitersModal';
import { TafsirSelectorModal } from './TafsirSelectorModal';

import {
  getAyahAudio,
  saveAyahAudio,
  getSurahAudio,
  saveSurahAudio,
  deleteSurahAudio,
  getDownloadedAyahCount,
  isSurahAudioDownloaded
} from '../utils/audioStorage';

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

const formatPageNum = (n: number) =>
  String(n).padStart(3, '0');

const pageImgUrl = (n: number) =>
  `https://android.quran.com/data/width_1260/page${formatPageNum(n)}.png`;

const AYAH_CANVAS_WIDTH = 1260;
const AYAH_CANVAS_HEIGHT = 2020;

type AyahBoxObj = {
  s: number;
  a: number;
  l: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

type SurahDownloadState = {
  downloaded: number;
  total: number;
  downloading: boolean;
  paused: boolean;
  error?: boolean;
};

type AudioSource = {
  url: string;
  startTime?: number;
  endTime?: number;
};

type Mp3QuranTiming = {
  ayah: number;
  start_time: number;
  end_time: number;
};

type Mp3QuranRead = {
  id: number;
  server: string;
  surah_total?: number;
  surah_list?: string;
};

/*
 * =========================================================
 * کاتی وردی دەستکاریکراو (MANUAL TIMING FILES)
 *
 * بۆ قاریانێک کە کاتی وردیان بەدەستی خۆمان دروستکردووە
 * (بە گوێگرتن و نیشانەکردنی چرکەکان)، فایلێکی JSON
 * دادەنرێت لە:
 *   public/ayah-timings/{reciterId}/{surahNumber}.json
 * بە شێوەی: [{ "ayah": 1, "start": 0.54, "end": 4.98 }, ...]
 *
 * ئەم جۆرە کاتیە پێشینەیەکی سەرەکی هەیە بەسەر هەموو
 * جۆرەکانی تردا (فەرمی، بۆشایی، هەندازەکراو).
 * =========================================================
 */

const gaplessTimingCache: Record<string, Mp3QuranTiming[] | null> = {};
const gaplessDbPromiseCache: Record<string, Promise<Uint8Array | null>> = {};

const loadGaplessTiming = async (
  reciter: ReciterItem,
  surahNumber: number,
  fallbackAudioUrl?: string,
  fallbackAyahCount?: number
): Promise<Mp3QuranTiming[] | null> => {
  if (!reciter.timingDbUrl) return null;

  const cacheKey = `${reciter.id}_${surahNumber}`;
  if (Object.prototype.hasOwnProperty.call(gaplessTimingCache, cacheKey)) {
    return gaplessTimingCache[cacheKey];
  }

  try {
    if (!gaplessDbPromiseCache[reciter.id]) {
      const localUrl = `${import.meta.env.BASE_URL}gapless-timing/${reciter.id}.db`;
      const candidates = [localUrl, reciter.timingDbUrl].filter(Boolean) as string[];

      gaplessDbPromiseCache[reciter.id] = (async () => {
        for (const url of candidates) {
          try {
            const response = await fetch(url, { cache: 'force-cache' });
            if (response.ok) {
              return new Uint8Array(await response.arrayBuffer());
            }
          } catch (error) {
            console.warn('Gapless DB candidate failed:', url, error);
          }
        }
        console.error('Gapless DB fetch failed for', reciter.id);
        return null;
      })();
    }

    const bytes = await gaplessDbPromiseCache[reciter.id];
    if (!bytes) {
      const fallbackRanges =
        fallbackAudioUrl && fallbackAyahCount
          ? await getSilenceBasedRanges(
              reciter.id,
              surahNumber,
              fallbackAudioUrl,
              fallbackAyahCount
            )
          : null;

      const fallbackTimings = fallbackRanges?.map(range => ({
        ayah: range.ayah,
        start_time: range.start,
        end_time: range.end
      })) ?? null;

      gaplessTimingCache[cacheKey] = fallbackTimings;
      return fallbackTimings;
    }

    const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
    const db = new SQL.Database(bytes);

    /*
     * Raad and Rizgar Kurdish have their own timing databases. Do not
     * assume their internal table/column names match the generic
     * gapless schema. Discover the timing table/columns from each DB,
     * then use the exact surah + ayah rows belonging to that reciter.
     *
     * Other gapless reciters keep the existing fixed schema.
     */
    let rows: any[][] = [];
    let endColumnPresent = false;

    if (reciter.id === 'raad_kurdi' || reciter.id === 'rizgar_kurdi') {
      const quoteIdentifier = (value: string) =>
        `"${value.replace(/"/g, '""')}"`;
      const normalizeColumnName = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]/g, '');

      const tableResult = db.exec(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      );
      const tableNames = (tableResult[0]?.values ?? [])
        .map(row => String(row[0] ?? ''))
        .filter(Boolean);

      const findColumn = (columns: string[], candidates: string[]) => {
        const wanted = new Set(candidates.map(normalizeColumnName));
        return columns.find(column =>
          wanted.has(normalizeColumnName(column))
        ) ?? null;
      };

      /*
       * Same Raad-style contract for both Kurdish gapless reciters:
       * one surah MP3 + the exact timing DB for that reciter.
       * Scan every compatible table because releases can use either
       * one table for all surahs or one table per surah.
       */
      const collectedRows: any[][] = [];

      for (const tableName of tableNames) {
        let info: any[];
        try {
          info = db.exec(
            `PRAGMA table_info(${quoteIdentifier(tableName)})`
          );
        } catch {
          continue;
        }

        const columns = (info[0]?.values ?? [])
          .map(row => String(row[1] ?? ''))
          .filter(Boolean);

        const foundSurah = findColumn(columns, [
          'sura','surah','suranumber','surahnumber','surah_number',
          'surah_id','sura_id','chapter','chapternumber',
          'chapter_number','chapter_id'
        ]);
        const foundAyah = findColumn(columns, [
          'ayah','aya','ayahnumber','ayah_number','ayah_id',
          'verse','verse_number','versenumber'
        ]);
        const foundStart = findColumn(columns, [
          'time','timems','timestamp','timestampms','start',
          'starttime','starttimems','start_time','start_ms',
          'from','begin','begin_time','position','offset'
        ]);
        const foundEnd = findColumn(columns, [
          'end','endtime','endtimems','end_time','end_ms',
          'to','finish','finishtime','finish_time'
        ]);

        const match = tableName.match(
          /(?:^|[^0-9])(\d{1,3})(?:[^0-9]|$)/
        );
        const tableNumber = match ? Number(match[1]) : null;

        if (
          !foundAyah ||
          !foundStart ||
          (!foundSurah && tableNumber !== surahNumber)
        ) {
          continue;
        }

        const selectedColumns = [
          quoteIdentifier(foundAyah),
          quoteIdentifier(foundStart),
          ...(foundEnd ? [quoteIdentifier(foundEnd)] : [])
        ].join(', ');

        const whereClause = foundSurah
          ? `WHERE ${quoteIdentifier(foundSurah)} = ${Number(surahNumber)}`
          : '';

        try {
          const result = db.exec(
            `SELECT ${selectedColumns}
             FROM ${quoteIdentifier(tableName)}
             ${whereClause}
             ORDER BY ${quoteIdentifier(foundAyah)} ASC`
          );
          const values = result[0]?.values ?? [];
          if (values.length) collectedRows.push(...values);
        } catch {
          // Continue with the next table.
        }
      }

      const seenAyahs = new Set<number>();
      rows = collectedRows
        .filter(row => {
          const ayah = Number(row[0]);
          if (!Number.isFinite(ayah) || seenAyahs.has(ayah)) return false;
          seenAyahs.add(ayah);
          return true;
        })
        .sort((a, b) => Number(a[0]) - Number(b[0]));

      if (!rows.length) {
        throw new Error(
          `${reciter.name} timing DB: no timing rows for surah ${surahNumber}`
        );
      }

      endColumnPresent = rows.some(row => row.length >= 3);
    }

    /*
     * Raad and Rizgar release timing databases use integer
     * milliseconds. Keep this explicit: 11000 means 11 seconds.
     */
    const toSeconds = (value: number) => {
      if (!Number.isFinite(value)) return 0;
      return value / 1000;
    };

    const points =
          gapless.timings;

        const current =
          resolveGaplessTimingAtTime(
            points,
            audio.currentTime
          );

        if (current) {
          const ayahData =
            pageAyahsData.find(
              item =>
                item.surahNumber ===
                  gapless.surahNumber &&
                item.numberInSurah ===
                  current.ayah
            );

          if (ayahData) {
            const key = ayahKey(ayahData);

            if (playingAyahKey !== key) {
              setPlayingAyahKey(key);
            }

            const box = ayahBoxes.find(
                b =>
                  b.s === ayahData.surahNumber &&
                  b.a === ayahData.numberInSurah
              );

            if (box) {
              /*
               * Every gapless reciter uses the same audio-driven
               * highlight path as Raad. The green highlight must
               * follow the ayah identified by the timing data,
               * not the manually selected ayah.
               */
              if (gaplessLastAyahKeyRef.current !== key) {
                gaplessLastAyahKeyRef.current = key;
                setAudioHighlightedAyah({
                  ayah: ayahData,
                  topPercent:
                    (box.y0 / AYAH_CANVAS_HEIGHT) * 100
                });
              }
            }
          }
        }
      }

      /*
       * کاتی ڕاستەقینە (mp3quran فەرمی).
       */
      if (
        segment &&
        segment.endTime !==
          null
      ) {
        if (
          audio.currentTime >=
          segment.endTime -
            0.05
        ) {
          audio.pause();

          try {
            audio.currentTime =
              segment.endTime;
          } catch {
            // Ignore
          }

          activeSegmentRef.current =
            null;

          handleAudioEnded();
        }

        return;
      }

      /*
       * هایلایتی نزیک/هەندازەکراو
       * (بۆ قاریانێک کە کاتی ڕاستەقینەیان نییە).
       */
      const estimated =
        estimatedTimingRef.current;

      if (!estimated) {
        return;
      }

      const t =
        audio.currentTime;

      const match =
        estimated.ranges.find(
          r =>
            t >= r.start &&
            t < r.end
        ) ||
        estimated.ranges[
          estimated.ranges
            .length - 1
        ];

      if (!match) {
        return;
      }

      const ayahData =
        pageAyahsData.find(
          a =>
            a.surahNumber ===
              estimated.surahNumber &&
            a.numberInSurah ===
              match.ayah
        );

      if (!ayahData) {
        return;
      }

      const key =
        ayahKey(ayahData);

      if (
        playingAyahKey !== key
      ) {
        setPlayingAyahKey(
          key
        );

        const box =
          ayahBoxes.find(
            b =>
              b.s ===
                ayahData.surahNumber &&
              b.a ===
                ayahData.numberInSurah
          );

        if (box) {
          setAudioHighlightedAyah({
            ayah: ayahData,
            topPercent:
              (box.y0 /
                AYAH_CANVAS_HEIGHT) *
              100
          });
        }
      }
    };

  /* =========================================================
     GAPLESS FRAME SYNC
  ========================================================= */

  useEffect(() => {
    const stopFrameSync = () => {
      if (gaplessSyncFrameRef.current !== null) {
        cancelAnimationFrame(
          gaplessSyncFrameRef.current
        );

        gaplessSyncFrameRef.current = null;
      }
    };

    if (
      !isPlayingAudio ||
      (selectedReciter.audioSource !== 'gapless' &&
        selectedReciter.audioSource !== 'mp3quran')
    ) {
      stopFrameSync();
      return;
    }

    const tick = () => {
      const audio = audioRef.current;
      const gapless = gaplessActiveTimingRef.current;

      if (
        !audio ||
        audio.paused ||
        !gapless ||
        !gapless.timings.length
      ) {
        stopFrameSync();
        return;
      }

      const points = gapless.timings;

      // Use exactly the same range resolver as timeupdate.
      // This prevents the two sync loops from fighting each other.
      const current =
        resolveGaplessTimingAtTime(
          points,
          audio.currentTime
        );

      if (current) {
        const ayahData =
          pageAyahsData.find(
            item =>
              item.surahNumber ===
                gapless.surahNumber &&
              item.numberInSurah ===
                current.ayah
          );

        if (ayahData) {
          const key = ayahKey(ayahData);

          if (gaplessLastAyahKeyRef.current !== key) {
            gaplessLastAyahKeyRef.current = key;
            setPlayingAyahKey(key);

            const box = ayahBoxes.find(
              b =>
                b.s === ayahData.surahNumber &&
                b.a === ayahData.numberInSurah
            );

            if (box) {
              setAudioHighlightedAyah({
                ayah: ayahData,
                topPercent:
                  (box.y0 / AYAH_CANVAS_HEIGHT) * 100
              });
            }
          }
        }
      }

      gaplessSyncFrameRef.current =
        requestAnimationFrame(tick);
    };

    gaplessLastAyahKeyRef.current =
      null;

    gaplessSyncFrameRef.current =
      requestAnimationFrame(tick);

    return stopFrameSync;
  }, [
    isPlayingAudio,
    selectedReciter.id,
    selectedReciter.audioSource,
    pageAyahsData,
    ayahBoxes
  ]);

  /* =========================================================
     ENDED
  ========================================================= */

  const handleAudioEnded =
    () => {
      activeSegmentRef.current =
        null;

      const currentIndex =
        pageAudioIndexRef.current;

      if (
        currentIndex >= 0 &&
        currentIndex < pageAyahsData.length
      ) {
        const currentAyah =
          pageAyahsData[currentIndex];

        const currentSurah =
          surahsList.find(
            s => s.number === currentAyah.surahNumber
          );

        let nextSurahNumber =
          currentAyah.surahNumber;
        let nextAyahNumber =
          currentAyah.numberInSurah + 1;

        if (
          currentSurah &&
          nextAyahNumber > currentSurah.ayahs
        ) {
          nextSurahNumber =
            currentAyah.surahNumber + 1;
          nextAyahNumber = 1;
        }

        const nextSurah =
          surahsList.find(
            s => s.number === nextSurahNumber
          );

        if (nextSurah) {
          const nextIndex =
            pageAyahsData.findIndex(
              item =>
                item.surahNumber ===
                  nextSurahNumber &&
                item.numberInSurah ===
                  nextAyahNumber
            );

          if (nextIndex >= 0) {
            void playPageAyahAtIndex(
              nextIndex
            );
            return;
          }

          if (
            nextSurah.startPage &&
            nextSurah.startPage !== currentPage &&
            onJumpToPage
          ) {
            pendingContinuousAyahRef.current = {
              surahNumber:
                nextSurahNumber,
              numberInSurah:
                nextAyahNumber
            };

            onJumpToPage(
              nextSurah.startPage
            );
            return;
          }
        }
      }

      pageAudioIndexRef.current =
        -1;

      setPageAudioIndex(
        -1
      );

      setPlayingAyahKey(
        null
      );

      setAudioHighlightedAyah(
        null
      );

      setIsPlayingAudio(
        false
      );
    };

  /* =========================================================
     AUDIO ERROR
  ========================================================= */

  const handleAudioError =
    () => {
      const audio =
        audioRef.current;

      if (!audio) {
        return;
      }

      console.error(
        'HTML Audio Error:',
        {
          src: audio.src,
          code:
            audio.error?.code,
          message:
            audio.error?.message
        }
      );

      setIsPlayingAudio(
        false
      );
    };

  /* =========================================================
     SCROLL HANDLER
  ========================================================= */

  const handleScroll = (
    e: React.UIEvent<HTMLDivElement>
  ) => {
    if (
      isUpdating.current
    ) {
      return;
    }

    const target =
      e.currentTarget;

    const scrollLeft =
      target.scrollLeft;

    const pageWidth =
      target.clientWidth;

    if (
      pageWidth > 0
    ) {
      const pageIndex =
        Math.round(
          scrollLeft /
            pageWidth
        );

      const targetPage =
        604 -
        pageIndex;

      if (
        targetPage >= 1 &&
        targetPage <= 604 &&
        targetPage !==
          currentPage
      ) {
        isUpdating.current =
          true;

        scrollInitiatedByUser.current =
          true;

        stopAudioCompletely();

        if (
          onJumpToPage
        ) {
          onJumpToPage(
            targetPage
          );
        } else if (
          targetPage >
          currentPage
        ) {
          onNextPage();
        } else {
          onPrevPage();
        }

        setTimeout(
          () => {
            isUpdating.current =
              false;
          },
          300
        );
      }
    }
  };

  /* =========================================================
     BOOKMARK
  ========================================================= */

  const toggleBookmark =
    () => {
      let updated:
        number[];

      if (
        isBookmarked
      ) {
        updated =
          bookmarks.filter(
            p =>
              p !==
              currentPage
          );
      } else {
        updated = [
          ...bookmarks,
          currentPage
        ];
      }

      setBookmarks(
        updated
      );

      localStorage.setItem(
        'quran_bookmarks',
        JSON.stringify(
          updated
        )
      );

      navigator.vibrate?.(35);
    };

  const selectedTafsirName =
    (selectedTafsir as any)
      .nameKu ||
    selectedTafsir.title ||
    selectedTafsir.id;

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      className="relative h-screen max-w-lg mx-auto flex flex-col justify-between select-none bg-stone-100 text-slate-900 overflow-hidden"
      dir="rtl"
    >
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={
          handleAudioTimeUpdate
        }
        onEnded={
          handleAudioEnded
        }
        onError={
          handleAudioError
        }
        onPause={() => {
          setIsPlayingAudio(
            false
          );
        }}
        onPlay={() => {
          setIsPlayingAudio(
            true
          );
        }}
      />

      {/* HEADER */}

      <header
        className={`absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs transition-all duration-300 ${
          showControls
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={
            onBackToIndex
          }
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
          title="گەڕانەوە"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        <div className="text-center min-w-0">
          <h2 className="font-bold text-sm text-slate-800 truncate">
            سووڕه‌تی{' '}
            {currentSurah?.nameAr ||
              'الفاتحة'}
          </h2>

          <p className="text-[11px] text-slate-500 font-medium">
            په‌ڕه‌ی{' '}
            {currentPage} ، جوزئی{' '}
            {currentJuz}
          </p>
        </div>

        <div className="flex items-center gap-1 text-slate-700">
          <button
            onClick={() =>
              setViewMode(
                prev =>
                  prev ===
                  'mushaf'
                    ? 'tafsir'
                    : 'mushaf'
              )
            }
            className={`p-2 rounded-xl transition-colors ${
              viewMode ===
              'tafsir'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'hover:bg-slate-100'
            }`}
            title="تەفسیر"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            onClick={
              toggleBookmark
            }
            className={`p-2 rounded-xl transition-colors ${
              isBookmarked
                ? 'text-amber-600'
                : 'hover:bg-slate-100'
            }`}
            title="نیشانەکردن"
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-4 h-4 fill-amber-500 text-amber-600" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() =>
              setIsTafsirSelectorOpen(
                true
              )
            }
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-700"
            title="تەفسیرەکان"
          >
            <Globe className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MUSHAF */}

      {viewMode ===
        'mushaf' && (
        <div
          className="relative flex-1 flex items-center justify-center bg-stone-200/60 overflow-hidden"
          onClick={() => {
            setShowControls(
              prev =>
                !prev
            );

            closeHighlight();
          }}
        >
          <div
            ref={
              scrollContainerRef
            }
            onScroll={
              handleScroll
            }
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-none items-center"
            style={{
              direction:
                'ltr'
            }}
          >
            {Array.from(
              {
                length: 604
              },
              (_, i) => {
                const pageNum =
                  604 - i;

                const isActivePage =
                  pageNum ===
                  currentPage;

                return (
                  <div
                    key={pageNum}
                    ref={el => {
                      pageRefs.current[
                        pageNum
                      ] = el;
                    }}
                    className="min-w-full h-full flex flex-col items-center justify-center snap-center snap-always p-2 shrink-0"
                    style={{
                      direction:
                        'rtl'
                    }}
                  >
                    <div
                      className="relative max-h-[76vh]"
                      style={{
                        aspectRatio:
                          `${AYAH_CANVAS_WIDTH} / ${AYAH_CANVAS_HEIGHT}`
                      }}
                    >
                      <img
                        src={pageImgUrl(
                          pageNum
                        )}
                        alt={`Page ${pageNum}`}
                        loading="lazy"
                        draggable={
                          false
                        }
                        onContextMenu={e =>
                          e.preventDefault()
                        }
                        className="w-full h-full max-h-[76vh] object-contain select-none shadow-xl rounded-lg bg-white border border-stone-300"
                        style={{
                          WebkitTouchCallout:
                            'none',
                          WebkitUserSelect:
                            'none',
                          userSelect:
                            'none'
                        }}
                      />

                      {isActivePage &&
                        ayahApiError && (
                          <div className="absolute top-1 inset-x-0 text-center text-[10px] font-bold bg-red-700/80 text-white py-1 z-50 pointer-events-none">
                            هەڵە:{' '}
                            {
                              ayahApiError
                            }
                          </div>
                        )}

                      {isActivePage &&
                        ayahBoxes.length >
                          0 && (
                          <div className="absolute inset-0">
                            {ayahBoxes.map(
                              (
                                box,
                                idx
                              ) => {
                                const matchedAyah =
                                  pageAyahsData.find(
                                    x =>
                                      x.surahNumber ===
                                        box.s &&
                                      x.numberInSurah ===
                                        box.a
                                  );

                                if (
                                  !matchedAyah
                                ) {
                                  return null;
                                }

                                const boxKey =
                                  `${box.s}-${box.a}-${box.l}-${idx}`;

                                const leftPct =
                                  (box.x0 /
                                    AYAH_CANVAS_WIDTH) *
                                  100;

                                const widthPct =
                                  ((box.x1 -
                                    box.x0) /
                                    AYAH_CANVAS_WIDTH) *
                                  100;

                                const topPct =
                                  (box.y0 /
                                    AYAH_CANVAS_HEIGHT) *
                                  100;

                                const heightPct =
                                  ((box.y1 -
                                    box.y0) /
                                    AYAH_CANVAS_HEIGHT) *
                                  100;

                                const isHighlighted =
                                  !!highlightedAyah &&
                                  highlightedAyah.ayah.surahNumber ===
                                    box.s &&
                                  highlightedAyah.ayah.numberInSurah ===
                                    box.a;

                                const isAudioHighlighted =
                                  !!audioHighlightedAyah &&
                                  audioHighlightedAyah.ayah.surahNumber === box.s &&
                                  audioHighlightedAyah.ayah.numberInSurah === box.a;

                                return (
                                  <div
                                    key={
                                      boxKey
                                    }
                                    onPointerDown={e => {
                                      e.stopPropagation();

                                      startLongPress(
                                        boxKey,
                                        matchedAyah,
                                        topPct
                                      );
                                    }}
                                    onPointerUp={e => {
                                      e.stopPropagation();
                                      cancelLongPress();
                                    }}
                                    onPointerLeave={
                                      cancelLongPress
                                    }
                                    onPointerCancel={
                                      cancelLongPress
                                    }
                                    onClick={e => {
                                      /*
                                       * Playback is NOT started by a normal tap.
                                       * Keep click propagation blocked so the page
                                       * itself does not close/change the ayah state.
                                       * Playback starts only after the long-press timer.
                                       */
                                      e.stopPropagation();

                                      if (
                                        longPressTriggeredRef.current
                                      ) {
                                        longPressTriggeredRef.current =
                                          false;
                                      }
                                    }}
                                    onContextMenu={e =>
                                      e.preventDefault()
                                    }
                                    style={{
                                      position:
                                        'absolute',
                                      left: `${leftPct}%`,
                                      top: `${topPct}%`,
                                      width: `${widthPct}%`,
                                      height: `${heightPct}%`,
                                      background:
                                        isAudioHighlighted
                                          ? 'rgba(70,166,70,0.38)'
                                          : isHighlighted
                                          ? 'rgba(56,189,248,0.35)'
                                          : pressingBox === boxKey
                                          ? 'rgba(56,189,248,0.15)'
                                          : 'transparent',
                                      borderRadius: '3px',
                                      transition: 'background 0.22s ease, box-shadow 0.22s ease',
                                      boxShadow: isAudioHighlighted
                                        ? '0 0 0 1px rgba(70,166,70,0.12)'
                                        : 'none'
                                    }}
                                    className="cursor-pointer touch-none"
                                  />
                                );
                              }
                            )}
                          </div>
                        )}

                      {isActivePage &&
                        highlightedAyah && (
                          <div
                            className="absolute inset-x-0 flex justify-center z-40"
                            style={{
                              top: `${Math.min(
                                Math.max(
                                  highlightedAyah.topPercent -
                                    7,
                                  2
                                ),
                                88
                              )}%`
                            }}
                            onClick={e =>
                              e.stopPropagation()
                            }
                          >
                            <div className="flex items-center gap-1 bg-emerald-800 text-white rounded-2xl shadow-xl px-1.5 py-1.5">
                              <button
                                onClick={() =>
                                  void playAyahAudio(
                                    highlightedAyah.ayah
                                  )
                                }
                                className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                                title="گوێگرتن"
                              >
                                {playingAyahKey ===
                                ayahKey(
                                  highlightedAyah.ayah
                                ) ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4 fill-white" />
                                )}
                              </button>

                              <button
                                onClick={() =>
                                  setTafsirSheetOpen(
                                    true
                                  )
                                }
                                className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                                title="تەفسیر"
                              >
                                <Globe className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() =>
                                  shareAyah(
                                    highlightedAyah.ayah
                                  )
                                }
                                className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                                title="ناردن"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() =>
                                  toggleAyahBookmark(
                                    highlightedAyah.ayah
                                  )
                                }
                                className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                                title="خەزنکردن"
                              >
                                {isAyahBookmarked(
                                  highlightedAyah.ayah
                                ) ? (
                                  <BookmarkCheck className="w-4 h-4 fill-white" />
                                ) : (
                                  <Bookmark className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                onClick={
                                  closeHighlight
                                }
                                className="p-2 rounded-xl hover:bg-emerald-700 transition-colors"
                                title="داخستن"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                    </div>

                    <span className="text-xs font-bold text-slate-700 mt-2 font-mono bg-white/90 px-3 py-1 rounded-full shadow-xs">
                      {pageNum}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          {/* TAFSIR SHEET */}

          {highlightedAyah &&
            tafsirSheetOpen && (
              <div
                className="absolute bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl p-5 max-h-[45vh] overflow-y-auto"
                dir="rtl"
                onClick={e =>
                  e.stopPropagation()
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    {
                      highlightedAyah
                        .ayah
                        .surahNumber
                    }
                    :
                    {
                      highlightedAyah
                        .ayah
                        .numberInSurah
                    }

                    {' — '}

                    {
                      selectedTafsirName
                    }
                  </span>

                  <button
                    onClick={() =>
                      setTafsirSheetOpen(
                        false
                      )
                    }
                    className="p-1.5 rounded-xl bg-slate-100 text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="font-quran text-lg text-slate-900 leading-relaxed mb-3">
                  {
                    highlightedAyah
                      .ayah
                      .arabic
                  }
                </p>

                {loadingTafsir ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />

                    <span className="text-xs">
                      تەفسیر باردەکرێت...
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {
                      highlightedAyah
                        .ayah
                        .tafsir
                    }
                  </p>
                )}

                {tafsirApiError &&
                  !loadingTafsir && (
                    <p className="mt-3 text-[11px] text-red-600 leading-relaxed">
                      {
                        tafsirApiError
                      }
                    </p>
                  )}

                <button
                  onClick={() => {
                    setTafsirSheetOpen(
                      false
                    );

                    setIsTafsirSelectorOpen(
                      true
                    );
                  }}
                  className="mt-3 text-xs font-bold text-amber-700 underline"
                >
                  گۆڕینی تەفسیر
                </button>
              </div>
            )}
        </div>
      )}

      {/* TAFSIR VIEW */}

      {viewMode ===
        'tafsir' && (
        <div
          className="flex-1 overflow-y-auto p-4 pt-16 space-y-6 bg-white"
          dir="rtl"
        >
          {loadingTafsir ? (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 mx-auto text-amber-600 animate-spin" />

              <p className="text-xs text-slate-500 pt-2">
                {
                  selectedTafsirName
                }{' '}
                باردەکرێت...
              </p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right">
                <p className="text-[11px] text-amber-800 font-bold">
                  تەفسیری هەڵبژێردراو:
                </p>

                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {
                    selectedTafsirName
                  }
                </p>

                <p className="text-[10px] text-slate-500 mt-0.5">
                  {
                    selectedTafsir.author
                  }
                </p>
              </div>

              {pageAyahsData.map(
                ayah => (
                  <div
                    key={`${ayah.surahNumber}:${ayah.numberInSurah}`}
                    className="space-y-3 pb-6 border-b border-slate-200 text-right"
                  >
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-mono font-bold">
                      {
                        ayah.surahNumber
                      }
                      :
                      {
                        ayah.numberInSurah
                      }
                    </span>

                    <p className="font-quran text-slate-900 text-xl sm:text-2xl leading-loose">
                      {
                        ayah.arabic
                      }
                    </p>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
                      <strong className="text-amber-800 block mb-1">
                        {
                          selectedTafsirName
                        }
                        :
                      </strong>

                      {
                        ayah.tafsir
                      }
                    </div>
                  </div>
                )
              )}
            </>
          )}

          {tafsirApiError &&
            !loadingTafsir && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed text-right">
                {
                  tafsirApiError
                }
              </div>
            )}
        </div>
      )}

      {/* FOOTER */}

      <footer
        className={`absolute bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-3 py-2.5 flex items-center justify-between shadow-lg transition-all duration-300 ${
          showControls
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        dir="rtl"
        onClick={e =>
          e.stopPropagation()
        }
      >
        <button
          onClick={() =>
            setIsRecitersModalOpen(
              true
            )
          }
          className="max-w-[35%] text-xs sm:text-sm font-bold text-slate-800 hover:text-amber-700 transition-colors flex items-center gap-1.5 min-w-0"
        >
          <span className="truncate">
            {
              selectedReciter.name
            }
          </span>
        </button>

        <div className="flex items-center gap-2">
          {renderCurrentSurahDownload()}

          <button
            onClick={
              togglePageAudio
            }
            className="p-2.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-transform active:scale-95 shadow-md shrink-0"
            title="دەنگی پەڕە"
          >
            {isPlayingAudio ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
          </button>
        </div>
      </footer>

      {/* RECITER MODAL */}

      <RecitersModal
        isOpen={
          isRecitersModalOpen
        }
        onClose={() =>
          setIsRecitersModalOpen(
            false
          )
        }
        selectedReciterId={
          selectedReciter.id
        }
        onSelectReciter={r => {
          stopAudioCompletely();

          setSelectedReciter(
            r
          );

          try {
            localStorage.setItem(
              'quran_selected_reciter',
              r.id
            );
          } catch {
            // Ignore
          }

          window.dispatchEvent(
            new CustomEvent(
              'quran-reciter-changed',
              {
                detail:
                  r.id
              }
            )
          );
        }}
      />

      {/* TAFSIR SELECTOR */}

      <TafsirSelectorModal
        isOpen={
          isTafsirSelectorOpen
        }
        onClose={() =>
          setIsTafsirSelectorOpen(
            false
          )
        }
        selectedTafsirId={
          selectedTafsir.id
        }
        onSelectTafsir={t => {
          setSelectedTafsir(
            t
          );
        }}
      />
    </div>
  );
};
