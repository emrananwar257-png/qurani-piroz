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
      if (
        reciter.id === 'raad_kurdi' ||
        reciter.id === 'rizgar_kurdi'
      ) {
        gaplessTimingCache[cacheKey] = null;
        return null;
      }

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
     * Raad/Rizgar timing exports have existed in both second-based
     * and millisecond-based forms. Do not hard-code one unit: infer
     * the unit from the magnitude of the complete timing track.
     * A Fatiha-like track reaching 40+ seconds cannot be milliseconds
     * if its largest raw value is only around 40.
     */
    const rawTimingValues = rows
      .flatMap(row => [
        Number(row[1]),
        endColumnPresent ? Number(row[2]) : NaN
      ])
      .filter(
        value =>
          Number.isFinite(value) &&
          value >= 0
      );

    const maxRawTiming =
      rawTimingValues.length
        ? Math.max(...rawTimingValues)
        : 0;

    const timingUnit:
      | 'seconds'
      | 'milliseconds' =
      maxRawTiming >= 1000
        ? 'milliseconds'
        : 'seconds';

    const toSeconds = (value: number) => {
      if (!Number.isFinite(value)) return 0;
      return timingUnit === 'milliseconds'
        ? value / 1000
        : value;
    };

    const points = rows
      .map(row => ({
        ayah: Number(row[0]),
        rawStartTime: Number(row[1]),
        rawEndTime:
          endColumnPresent
            ? Number(row[2])
            : null
      }))
      .filter(
        row =>
          Number.isFinite(row.ayah) &&
          Number.isFinite(row.rawStartTime)
      )
      .map(row => ({
        ayah: row.ayah,
        timeMs: toSeconds(row.rawStartTime),
        endTimeMs:
          row.rawEndTime !== null &&
          Number.isFinite(row.rawEndTime)
            ? toSeconds(row.rawEndTime)
            : null
      }));

    const timings: Mp3QuranTiming[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      if (point.ayah < 1 || point.ayah > 998) continue;

      const next = points[i + 1];
      const nextStart = next?.timeMs ?? null;
      const directEnd = point.endTimeMs;

      const endTime =
        directEnd !== null && directEnd > point.timeMs
          ? directEnd
          : nextStart;

      if (
        endTime === null ||
        endTime <= point.timeMs
      ) {
        continue;
      }

      timings.push({
        ayah: point.ayah,
        start_time: point.timeMs,
        end_time: endTime
      });
    }

    db.close();

    if (timings.length) {
      gaplessTimingCache[cacheKey] = timings;
      return timings;
    }

    if (
      reciter.id === 'raad_kurdi' ||
      reciter.id === 'rizgar_kurdi'
    ) {
      gaplessTimingCache[cacheKey] = null;
      return null;
    }

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
  } catch (error) {
    console.error('Gapless timing DB error:', error);

    /*
     * Raad/Rizgar are exact gapless readers. A silence estimate is
     * not a valid substitute for their real timing DB because it can
     * make the audio and green highlight disagree. Keep the failure
     * explicit so the same exact pipeline is used for both readers.
     */
    if (
      reciter.id === 'raad_kurdi' ||
      reciter.id === 'rizgar_kurdi'
    ) {
      gaplessTimingCache[cacheKey] = null;
      return null;
    }

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
};
const resolveGaplessTimingAtTime = (
  timings: Mp3QuranTiming[],
  currentTime: number
): Mp3QuranTiming | null => {
  if (!timings.length || !Number.isFinite(currentTime)) {
    return null;
  }

  const tMs = currentTime * 1000;

  for (let i = 0; i < timings.length; i += 1) {
    const item = timings[i];
    const isLast = i === timings.length - 1;
    const startMs = item.start_time * 1000;
    const endMs = item.end_time * 1000;

    if (
      tMs >= startMs &&
      (isLast || tMs < endMs)
    ) {
      return item;
    }
  }

  /*
   * Small gaps can exist between exported ayah boundaries. During
   * those gaps, keep the highlight on the most recently started ayah
   * instead of making the green highlight disappear while audio is
   * still playing. Never jump forward to an ayah that has not started.
   */
  let latest: Mp3QuranTiming | null = null;
  for (const item of timings) {
    if (currentTime >= item.start_time) {
      latest = item;
    } else {
      break;
    }
  }

  return latest;
};

const manualTimingCache: Record<
  string,
  Mp3QuranTiming[] | null
> = {};

const loadManualTiming = async (
  reciterId: string,
  surahNumber: number
): Promise<Mp3QuranTiming[] | null> => {
  const cacheKey = `${reciterId}_${surahNumber}`;

  if (
    Object.prototype.hasOwnProperty.call(
      manualTimingCache,
      cacheKey
    )
  ) {
    return manualTimingCache[
      cacheKey
    ];
  }

  try {
    const base = String(
      (import.meta as any).env
        ?.BASE_URL || '/'
    );

    const url =
      `${base}ayah-timings/${reciterId}/${surahNumber}.json`;

    const response = await fetch(
      url,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      manualTimingCache[
        cacheKey
      ] = null;

      return null;
    }

    const data =
      await response.json();

    if (
      !Array.isArray(data)
    ) {
      manualTimingCache[
        cacheKey
      ] = null;

      return null;
    }

    const timings: Mp3QuranTiming[] =
      data
        .map((item: any) => ({
          ayah: Number(
            item?.ayah
          ),
          start_time: Number(
            item?.start ??
              item?.start_time
          ),
          end_time: Number(
            item?.end ??
              item?.end_time
          )
        }))
        .filter(
          (
            item: Mp3QuranTiming
          ) =>
            Number.isFinite(
              item.ayah
            ) &&
            Number.isFinite(
              item.start_time
            ) &&
            Number.isFinite(
              item.end_time
            ) &&
            item.end_time >
              item.start_time
        );

    /*
     * زیادکردنی کەمێک کاتی زیادە (padding) بۆ کۆتایی
     * هەر ئایەتێک، بۆ ئەوەی دەنگی ڕاستەقینە پێش کاتی
     * نیشانەکراو نەبڕدرێت (چونکە بە دەست نیشانەکردنی
     * کۆتایی زۆرجار کەمێک زوویە). هەرگیز ناچێتە ناو
     * دەستپێکی ئایەتی دواتر.
     */
    const END_PADDING_SECONDS = 0.15;

    const sortedTimings = timings
      .slice()
      .sort(
        (a, b) => a.ayah - b.ayah
      );

    const paddedTimings =
      sortedTimings.map(
        (item, idx) => {
          const next =
            sortedTimings[idx + 1];

          const maxEnd = next
            ? next.start_time -
              0.05
            : item.end_time +
              END_PADDING_SECONDS;

          const desiredEnd =
            item.end_time +
            END_PADDING_SECONDS;

          const paddedEnd =
            Math.min(
              desiredEnd,
              maxEnd
            );

          return {
            ...item,
            end_time: Math.max(
              paddedEnd,
              item.end_time
            )
          };
        }
      );

    manualTimingCache[
      cacheKey
    ] = paddedTimings.length
      ? paddedTimings
      : null;

    return manualTimingCache[
      cacheKey
    ];
  } catch (error) {
    manualTimingCache[
      cacheKey
    ] = null;

    return null;
  }
};

type EstimatedAyahRange = {
  ayah: number;
  start: number;
  end: number;
};

type EstimatedTiming = {
  reciterId: string;
  surahNumber: number;
  ranges: EstimatedAyahRange[];
};

/*
 * =========================================================
 * هەندازەکردنی کاتی ئایەت (ESTIMATED TIMING)
 *
 * بۆ قاریانێک کە کاتی وردیان لە mp3quran.net فەرمی
 * بەردەست نییە (وەک قاریە کوردەکانی GitHub)، ناتوانین
 * کاتی ڕاستەقینە بدۆزینەوە. لەبری ئەوە، ماوەی سورەتەکە
 * (audio.duration) بەسەر ئایەتەکاندا دابەش دەکەین بەپێی
 * ڕێژەی ژمارەی وشەکانی هەر ئایەتێک. ئەمە نزیکە نەک
 * ڕاست، بەڵام زۆر باشترە لە هیچ هایلایتێک.
 * =========================================================
 */

const surahWordCountsCache: Record<
  number,
  number[]
> = {};

const getSurahWordCounts = async (
  surahNumber: number
): Promise<number[]> => {
  if (
    surahWordCountsCache[surahNumber]
  ) {
    return surahWordCountsCache[
      surahNumber
    ];
  }

  try {
    const res = await fetch(
      `https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`
    );

    const data = await res.json();

    const ayahs = Array.isArray(
      data?.data?.ayahs
    )
      ? data.data.ayahs
      : [];

    const counts = ayahs.map(
      (a: any) => {
        const text = String(
          a?.text || ''
        ).trim();

        const words = text
          .split(/\s+/)
          .filter(Boolean);

        return Math.max(
          1,
          words.length
        );
      }
    );

    surahWordCountsCache[
      surahNumber
    ] = counts;

    return counts;
  } catch (error) {
    console.warn(
      'Estimated timing: surah word counts fetch failed',
      error
    );

    return [];
  }
};

const buildEstimatedRanges = (
  counts: number[],
  duration: number
): EstimatedAyahRange[] => {
  const totalWords = counts.reduce(
    (sum, c) => sum + c,
    0
  );

  if (
    !totalWords ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return [];
  }

  let elapsed = 0;

  return counts.map(
    (count, idx) => {
      const share =
        (count / totalWords) *
        duration;

      const start = elapsed;
      const end = elapsed + share;

      elapsed = end;

      return {
        ayah: idx + 1,
        start,
        end
      };
    }
  );
};

/*
 * =========================================================
 * دۆزینەوەی بۆشایی (SILENCE DETECTION)
 *
 * لەبری هەندازەکردنی کوێر بەپێی وشە، خودی فایلی دەنگ شی
 * دەکەینەوە بۆ دۆزینەوەی بۆشاییەکانی ڕاستەقینەی نێوان
 * ئایەتەکان. ئەنجامەکە هەمیشە پاشەکەوت دەکرێت
 * (localStorage) بۆ ئەوەی تەنها یەک جار بۆ هەر
 * قاری/سورەت ئەنجام بدرێت.
 * =========================================================
 */

const SILENCE_CACHE_PREFIX =
  'quran_silence_timing_v1_';

const silenceRangesMemoryCache: Record<
  string,
  EstimatedAyahRange[] | null
> = {};

const readSilenceCache = (
  key: string
): EstimatedAyahRange[] | null => {
  if (
    Object.prototype.hasOwnProperty.call(
      silenceRangesMemoryCache,
      key
    )
  ) {
    return silenceRangesMemoryCache[
      key
    ];
  }

  try {
    const raw =
      localStorage.getItem(
        SILENCE_CACHE_PREFIX + key
      );

    if (!raw) {
      return undefined as any;
    }

    const parsed = JSON.parse(raw);

    if (
      Array.isArray(parsed)
    ) {
      silenceRangesMemoryCache[
        key
      ] = parsed;

      return parsed;
    }
  } catch {
    // Ignore
  }

  return undefined as any;
};

const writeSilenceCache = (
  key: string,
  ranges: EstimatedAyahRange[] | null
) => {
  silenceRangesMemoryCache[key] =
    ranges;

  try {
    if (ranges) {
      localStorage.setItem(
        SILENCE_CACHE_PREFIX + key,
        JSON.stringify(ranges)
      );
    }
  } catch {
    // Storage full or unavailable — ignore.
  }
};

const boundariesToRanges = (
  boundaries: number[],
  duration: number
): EstimatedAyahRange[] => {
  const points = [
    0,
    ...boundaries,
    duration
  ];

  const ranges: EstimatedAyahRange[] =
    [];

  for (
    let i = 0;
    i < points.length - 1;
    i++
  ) {
    ranges.push({
      ayah: i + 1,
      start: points[i],
      end: points[i + 1]
    });
  }

  return ranges;
};

/*
 * شیکردنەوەی دەنگ بۆ دۆزینەوەی بۆشاییەکان.
 * ئارایەیەک لە کاتی چرکە (چرکە) دەگەڕێنێتەوە کە
 * پێدەچێت سنووری نێوان ئایەتەکان بن، یان null
 * ئەگەر نەیتوانی بە دڵنیاییەوە بیاندۆزێتەوە.
 */
const detectSilenceBoundaries = async (
  audioBuffer: AudioBuffer,
  ayahCount: number
): Promise<number[] | null> => {
  try {
    const sampleRate =
      audioBuffer.sampleRate;

    const channelData =
      audioBuffer.getChannelData(
        0
      );

    const windowSeconds = 0.05;

    const windowSize = Math.max(
      1,
      Math.floor(
        sampleRate * windowSeconds
      )
    );

    const numWindows = Math.floor(
      channelData.length /
        windowSize
    );

    if (numWindows < 4) {
      return null;
    }

    const energies = new Float32Array(
      numWindows
    );

    for (
      let w = 0;
      w < numWindows;
      w++
    ) {
      let sum = 0;

      const start = w * windowSize;
      const end =
        start + windowSize;

      for (
        let i = start;
        i < end;
        i++
      ) {
        const s = channelData[i];

        sum += s * s;
      }

      energies[w] = Math.sqrt(
        sum / windowSize
      );
    }

    const sorted = Array.from(
      energies
    ).sort((a, b) => a - b);

    const noiseFloor =
      sorted[
        Math.floor(
          sorted.length * 0.05
        )
      ] || 0;

    const peak =
      sorted[
        sorted.length - 1
      ] || 0.0001;

    const threshold =
      noiseFloor +
      (peak - noiseFloor) * 0.1;

    const minSilenceWindows =
      Math.max(
        2,
        Math.ceil(
          0.12 / windowSeconds
        )
      );

    type Run = {
      startWindow: number;
      endWindow: number;
    };

    const runs: Run[] = [];

    let runStart = -1;

    for (
      let w = 0;
      w < numWindows;
      w++
    ) {
      if (
        energies[w] < threshold
      ) {
        if (runStart === -1) {
          runStart = w;
        }
      } else if (
        runStart !== -1
      ) {
        if (
          w - runStart >=
          minSilenceWindows
        ) {
          runs.push({
            startWindow: runStart,
            endWindow: w
          });
        }

        runStart = -1;
      }
    }

    if (
      runStart !== -1 &&
      numWindows - runStart >=
        minSilenceWindows
    ) {
      runs.push({
        startWindow: runStart,
        endWindow: numWindows
      });
    }

    const edgeGuardWindows =
      minSilenceWindows;

    const candidates = runs
      .filter(
        r =>
          r.startWindow >
            edgeGuardWindows &&
          r.endWindow <
            numWindows -
              edgeGuardWindows
      )
      .map(r => ({
        time:
          ((r.startWindow +
            r.endWindow) /
            2) *
          windowSize /
          sampleRate,
        strength:
          r.endWindow -
          r.startWindow
      }));

    const needed = ayahCount - 1;

    if (needed <= 0) {
      return [];
    }

    if (
      candidates.length < needed
    ) {
      return null;
    }

    const chosen = candidates
      .sort(
        (a, b) =>
          b.strength - a.strength
      )
      .slice(0, needed)
      .sort(
        (a, b) => a.time - b.time
      )
      .map(c => c.time);

    return chosen;
  } catch (error) {
    console.warn(
      'Silence detection failed:',
      error
    );

    return null;
  }
};

/*
 * وەرگرتنی ڕەنجی هاندازەکراوی سنووری ئایەتەکان بەپێی
 * شیکردنەوەی بۆشایی، لەگەڵ پاشەکەوتکردنی هەمیشەیی.
 * ئەگەر پێشتر پاشەکەوتکراوە، ڕاستەوخۆ لەوێ دەیهێنێتەوە
 * بەبێ دووبارە شیکردنەوە.
 */
const getSilenceBasedRanges = async (
  reciterId: string,
  surahNumber: number,
  audioUrl: string,
  ayahCount: number
): Promise<
  EstimatedAyahRange[] | null
> => {
  const cacheKey = `${reciterId}_${surahNumber}`;

  const cached =
    readSilenceCache(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const AudioContextClass =
    (window as any).AudioContext ||
    (window as any)
      .webkitAudioContext;

  if (!AudioContextClass) {
    writeSilenceCache(
      cacheKey,
      null
    );

    return null;
  }

  let audioCtx:
    AudioContext | null = null;

  try {
    const response = await fetch(
      audioUrl
    );

    if (!response.ok) {
      writeSilenceCache(
        cacheKey,
        null
      );

      return null;
    }

    const arrayBuffer =
      await response.arrayBuffer();

    audioCtx =
      new AudioContextClass();

    const audioBuffer =
      await audioCtx.decodeAudioData(
        arrayBuffer
      );

    const boundaries =
      await detectSilenceBoundaries(
        audioBuffer,
        ayahCount
      );

    if (!boundaries) {
      writeSilenceCache(
        cacheKey,
        null
      );

      return null;
    }

    const ranges =
      boundariesToRanges(
        boundaries,
        audioBuffer.duration
      );

    writeSilenceCache(
      cacheKey,
      ranges
    );

    return ranges;
  } catch (error) {
    console.warn(
      'Silence-based timing generation failed:',
      error
    );

    writeSilenceCache(
      cacheKey,
      null
    );

    return null;
  } finally {
    try {
      void audioCtx?.close();
    } catch {
      // Ignore
    }
  }
};

const LONG_PRESS_MS = 550;

const TAFSIR_API_EDITION: Record<
  string,
  string
> = {
  ku_asan: 'ku.asan',
  ar_muyassar: 'ar.muyassar',
  ar_jalalayn: 'ar.jalalayn',
  en_sahih: 'en.sahih',
  en_pickthall: 'en.pickthall',
  en_yusuf_ali: 'en.yusufali',
  en_hilali_khan: 'en.hilali',
  en_maududi: 'en.maududi',
  en_transliteration: 'en.transliteration',
  fa_ahsan_kalam: 'fa.ansarian',
  tr_diyanet: 'tr.diyanet',
  tr_elmali: 'tr.yazir',
  de_bubenheim: 'de.bubenheim',
  fr_hamidullah: 'fr.hamidullah',
  ru_kuliev: 'ru.kuliev',
  ru_abu_adel: 'ru.abuadel',
  es_cortes: 'es.cortes',
  ur_maududi: 'ur.maududi',
  ur_junagarhi: 'ur.junagarhi',
  id_sabeq: 'id.indonesian',
  ms_basmeih: 'ms.basmeih',
  sq_nahi: 'sq.nahi',
  am_sadiq: 'am.sadiq',
  az_musayev: 'az.musayev',
  bn_zakaria: 'bn.bengali',
  bs_korkut: 'bs.korkut',
  zh_majian: 'zh.jian',
  nl_abdalsalaam: 'nl.keyzer',
  ha_gumi: 'ha.gumi',
  hi_umari: 'hi.hindi',
  it_piccardo: 'it.piccardo',
  ja_mita: 'ja.japanese',
  ko_choi: 'ko.korean',
  ml_parappoor: 'ml.abdulhameed',
  ps_abdulsalam: 'ps.abdulsalam',
  so_abduh: 'so.abduh',
  sw_barwani: 'sw.barwani',
  sv_bernstrom: 'sv.bernstrom',
  tg_rowwad: 'tg.ayati',
  th_kingfahad: 'th.thai',
  ug_saleh: 'ug.saleh',
  uz_yusuf: 'uz.sodik'
};

/* =========================================================
   INITIAL RECITER
========================================================= */

const getInitialReciter =
  (): ReciterItem => {
    try {
      const savedId =
        localStorage.getItem(
          'quran_selected_reciter'
        );

      if (savedId) {
        const savedReciter =
          ALL_RECITERS_DIRECTORY.find(
            r => r.id === savedId
          );

        if (savedReciter) {
          return savedReciter;
        }
      }
    } catch {
      // Ignore
    }

    return (
      ALL_RECITERS_DIRECTORY[18] ||
      ALL_RECITERS_DIRECTORY[0]
    );
  };

/* =========================================================
   NORMALIZE
========================================================= */

const normalizeUrl = (
  value: string
) =>
  value
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();

/* =========================================================
   EVERYAYAH
========================================================= */

const makeEveryAyahUrl = (
  reciter: ReciterItem,
  surahNumber: number,
  ayahNumber: number
) => {
  const surah =
    String(surahNumber).padStart(3, '0');

  const ayah =
    String(ayahNumber).padStart(3, '0');

  return (
    `https://everyayah.com/data/` +
    `${reciter.serverKey}/` +
    `${surah}${ayah}.mp3`
  );
};

/* =========================================================
   MP3QURAN SURAH
========================================================= */

const makeMp3QuranSurahUrl = (
  reciter: ReciterItem,
  surahNumber: number
) => {
  if (!reciter.audioBaseUrl) {
    return null;
  }

  const base =
    reciter.audioBaseUrl.endsWith('/')
      ? reciter.audioBaseUrl
      : `${reciter.audioBaseUrl}/`;

  return (
    `${base}${String(
      surahNumber
    ).padStart(3, '0')}.mp3`
  );
};

/* =========================================================
   TIME NORMALIZER
========================================================= */

const normalizeTimingValue = (
  value: number
) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  /*
   * MP3Quran's ayat_timing endpoint returns start_time/end_time
   * in milliseconds. Do not guess the unit from the numeric size:
   * a valid value such as 5587 means 5.587 seconds.
   */
  return value / 1000;
};

/* =========================================================
   COMPONENT
========================================================= */

export const MushafPageView: React.FC<
  MushafPageViewProps
> = ({
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
  const [
    viewMode,
    setViewMode
  ] = useState<
    'mushaf' | 'tafsir'
  >('mushaf');

  const [
    showControls,
    setShowControls
  ] = useState(true);

  const [
    isRecitersModalOpen,
    setIsRecitersModalOpen
  ] = useState(false);

  const [
    isTafsirSelectorOpen,
    setIsTafsirSelectorOpen
  ] = useState(false);

  const [
    selectedReciter,
    setSelectedReciter
  ] = useState<ReciterItem>(
    getInitialReciter
  );

  const [
    selectedTafsir,
    setSelectedTafsir
  ] = useState<TafsirItem>(
    ALL_TAFSIRS_DIRECTORY[0]
  );

  const [
    pageAyahsData,
    setPageAyahsData
  ] = useState<any[]>([]);

  const [
    loadingTafsir,
    setLoadingTafsir
  ] = useState(false);

  const [
    ayahApiError,
    setAyahApiError
  ] = useState<string | null>(null);

  const [
    tafsirApiError,
    setTafsirApiError
  ] = useState<string | null>(null);

  const [
    bookmarks,
    setBookmarks
  ] = useState<number[]>(
    () => {
      try {
        const saved =
          localStorage.getItem(
            'quran_bookmarks'
          );

        return saved
          ? JSON.parse(saved)
          : [];
      } catch {
        return [];
      }
    }
  );

  const [
    isPlayingAudio,
    setIsPlayingAudio
  ] = useState(false);

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const [
    playingAyahKey,
    setPlayingAyahKey
  ] = useState<string | null>(
    null
  );

  const audioObjectUrlRef =
    useRef<string | null>(null);

  const loadedLocalBlobKeyRef =
    useRef<string | null>(null);

  const audioRequestIdRef =
    useRef(0);

  /* =========================================================
     MP3QURAN CACHE
  ========================================================= */

  const mp3TimingCacheRef =
    useRef<
      Record<
        string,
        Mp3QuranTiming[]
      >
    >({});

  const mp3ReadCacheRef =
    useRef<
      Record<
        string,
        Mp3QuranRead | null
      >
    >({});

  const activeSegmentRef =
    useRef<{
      endTime: number | null;
      requestId: number;
    } | null>(null);

  const gaplessActiveTimingRef =
    useRef<{
      surahNumber: number;
      timings: Mp3QuranTiming[];
    } | null>(null);

  const gaplessSyncFrameRef =
    useRef<number | null>(null);

  const gaplessLastAyahKeyRef =
    useRef<string | null>(null);

  const estimatedTimingRef =
    useRef<EstimatedTiming | null>(
      null
    );

  /* =========================================================
     DOWNLOAD
  ========================================================= */

  const [
    surahDownloadState,
    setSurahDownloadState
  ] = useState<SurahDownloadState>({
    downloaded: 0,
    total: 0,
    downloading: false,
    paused: false,
    error: false
  });

  const downloadAbortControllerRef =
    useRef<AbortController | null>(null);

  const downloadSessionRef =
    useRef(0);

  /* =========================================================
     AUDIO URL CLEANUP
  ========================================================= */

  const clearAudioObjectUrl =
    () => {
      if (
        audioObjectUrlRef.current
      ) {
        try {
          URL.revokeObjectURL(
            audioObjectUrlRef.current
          );
        } catch {
          // Ignore
        }

        audioObjectUrlRef.current =
          null;
      }
    };

  /* =========================================================
     STOP AUDIO COMPLETELY
  ========================================================= */

  const stopAudioCompletely =
    () => {
      audioRequestIdRef.current++;

      activeSegmentRef.current =
        null;

      gaplessActiveTimingRef.current =
        null;

      gaplessLastAyahKeyRef.current =
        null;

      if (gaplessSyncFrameRef.current !== null) {
        cancelAnimationFrame(
          gaplessSyncFrameRef.current
        );
        gaplessSyncFrameRef.current = null;
      }

      estimatedTimingRef.current =
        null;

      if (
        audioRef.current
      ) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.removeAttribute(
            'src'
          );
          audioRef.current.load();
        } catch {
          // Ignore
        }
      }

      clearAudioObjectUrl();

      loadedLocalBlobKeyRef.current =
        null;

      setIsPlayingAudio(false);
      setPlayingAyahKey(null);
      setAudioHighlightedAyah(null);

      pageAudioIndexRef.current =
        -1;

      setPageAudioIndex(-1);
    };

  /* =========================================================
     GET MP3QURAN READ
  ========================================================= */

  const getMp3QuranRead =
    async (
      reciter: ReciterItem
    ): Promise<Mp3QuranRead | null> => {
      const cacheKey =
        reciter.id;

      if (
        Object.prototype.hasOwnProperty.call(
          mp3ReadCacheRef.current,
          cacheKey
        )
      ) {
        return (
          mp3ReadCacheRef.current[
            cacheKey
          ]
        );
      }

      if (
        !reciter.audioBaseUrl
      ) {
        mp3ReadCacheRef.current[
          cacheKey
        ] = null;

        return null;
      }

      /*
       * Peshawa's MP3Quran source is explicitly moshaf/read 268.
       * This is the exact moshaf whose server is:
       * server16.mp3quran.net/peshawa/Rewayat-Hafs-A-n-Assem/
       * Using a fixed read ID prevents timing data from another
       * Peshawa moshaf from ever being selected by fuzzy matching.
       */
      if (
        reciter.id ===
        'peshawa_kurdi'
      ) {
        const exactPeshawaRead: Mp3QuranRead = {
          id: 268,
          server:
            reciter.audioBaseUrl,
          surah_total: 114,
          surah_list:
            Array.from(
              { length: 114 },
              (_, index) =>
                index + 1
            ).join(',')
        };

        mp3ReadCacheRef.current[
          cacheKey
        ] = exactPeshawaRead;

        return exactPeshawaRead;
      }

      try {
        const response =
          await fetch(
            'https://mp3quran.net/api/v3/reciters?language=eng'
          );

        if (!response.ok) {
          throw new Error(
            `MP3Quran API HTTP ${response.status}`
          );
        }

        const data =
          await response.json();

        const remoteReciters =
          Array.isArray(
            data?.reciters
          )
            ? data.reciters
            : [];

        const localBase =
          normalizeUrl(
            reciter.audioBaseUrl
          );

        let exactFound:
          | Mp3QuranRead
          | null = null;

        let fallbackFound:
          | Mp3QuranRead
          | null = null;

        for (
          const remoteReciter of remoteReciters
        ) {
          const moshafs =
            Array.isArray(
              remoteReciter?.moshaf
            )
              ? remoteReciter.moshaf
              : [];

          for (
            const moshaf of moshafs
          ) {
            const server =
              String(
                moshaf?.server || ''
              );

            const remoteServer =
              normalizeUrl(server);

            if (
              !remoteServer ||
              !localBase
            ) {
              continue;
            }

            const id =
              Number(moshaf?.id);

            if (
              !Number.isFinite(id)
            ) {
              continue;
            }

            const candidate: Mp3QuranRead = {
              id,
              server,
              surah_total:
                Number(
                  moshaf?.surah_total
                ),
              surah_list:
                String(
                  moshaf?.surah_list ||
                    ''
                )
            };

            /*
             * Prefer the exact audio folder used by the app.
             * Only use the old contains/substring matching as a
             * fallback, because choosing a different moshaf's
             * timing data can desynchronize the highlight from audio.
             */
            if (
              localBase ===
              remoteServer
            ) {
              exactFound = candidate;
              break;
            }

            const matches =
              localBase.includes(
                remoteServer
              ) ||
              remoteServer.includes(
                localBase
              );

            if (
              matches &&
              !fallbackFound
            ) {
              fallbackFound = candidate;
            }
          }

          if (exactFound) {
            break;
          }
        }

        const found =
          exactFound ??
          fallbackFound;

        mp3ReadCacheRef.current[
          cacheKey
        ] = found;

        return found;
      } catch (error) {
        console.error(
          'MP3Quran read lookup failed:',
          error
        );

        mp3ReadCacheRef.current[
          cacheKey
        ] = null;

        return null;
      }
    };

  /* =========================================================
     GET MP3QURAN TIMING
  ========================================================= */

  const getMp3QuranTiming =
    async (
      reciter: ReciterItem,
      surahNumber: number
    ): Promise<
      Mp3QuranTiming[]
    > => {
      const cacheKey =
        `${reciter.id}_${surahNumber}`;

      if (
        mp3TimingCacheRef.current[
          cacheKey
        ]
      ) {
        return (
          mp3TimingCacheRef.current[
            cacheKey
          ]
        );
      }

      const read =
        await getMp3QuranRead(
          reciter
        );

      if (!read) {
        return [];
      }

      try {
        const response =
          await fetch(
            `https://mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${read.id}`
          );

        if (!response.ok) {
          throw new Error(
            `MP3Quran timing HTTP ${response.status}`
          );
        }

        const data =
          await response.json();

        /*
         * Different API responses can expose
         * the timing array under different names.
         */
        let raw: any[] = [];

        if (
          Array.isArray(data)
        ) {
          raw = data;
        } else if (
          Array.isArray(data?.ayat)
        ) {
          raw = data.ayat;
        } else if (
          Array.isArray(data?.data)
        ) {
          raw = data.data;
        } else if (
          Array.isArray(
            data?.timing
          )
        ) {
          raw = data.timing;
        } else if (
          Array.isArray(
            data?.ayahs
          )
        ) {
          raw = data.ayahs;
        }

        const timings =
          raw
            .map(
              (item: any) => {
                const ayah =
                  Number(
                    item?.ayah ??
                      item?.ayah_number ??
                      item?.number
                  );

                const startRaw =
                  Number(
                    item?.start_time ??
                      item?.start ??
                      item?.startTime
                  );

                const endRaw =
                  Number(
                    item?.end_time ??
                      item?.end ??
                      item?.endTime
                  );

                return {
                  ayah,
                  start_time:
                    normalizeTimingValue(
                      startRaw
                    ),
                  end_time:
                    normalizeTimingValue(
                      endRaw
                    )
                };
              }
            )
            .filter(
              (
                item: Mp3QuranTiming
              ) =>
                Number.isFinite(
                  item.ayah
                ) &&
                item.ayah > 0 &&
                Number.isFinite(
                  item.start_time
                ) &&
                Number.isFinite(
                  item.end_time
                ) &&
                item.end_time >
                  item.start_time
            );

        mp3TimingCacheRef.current[
          cacheKey
        ] = timings;

        return timings;
      } catch (error) {
        console.error(
          'MP3Quran timing error:',
          error
        );

        mp3TimingCacheRef.current[
          cacheKey
        ] = [];

        return [];
      }
    };

  /* =========================================================
     GET AUDIO SOURCE
  ========================================================= */

  const getAudioSource =
    async (
      reciter: ReciterItem,
      surahNumber: number,
      ayahNumber: number
    ): Promise<AudioSource> => {
      /*
       * ===============================================
       * GAPLESS RECITERS — ONE SURAH MP3 + SQLITE DB
       * ===============================================
       *
       * One continuous MP3 per surah + the official SQLite
       * timing database used to locate each ayah exactly.
       */
      if (reciter.audioSource === 'gapless') {
        const base = reciter.audioBaseUrl?.endsWith('/')
          ? reciter.audioBaseUrl
          : reciter.audioBaseUrl ? `${reciter.audioBaseUrl}/` : '';

        if (!base) {
          throw new Error(`URL ـی دەنگ بۆ ${reciter.name} نەدۆزرایەوە`);
        }

        const url =
          `${base}${String(surahNumber).padStart(3, '0')}.mp3`;

        const surahInfo =
          surahsList.find(s => s.number === surahNumber);

        /*
         * Audio must never depend on the timing DB loading successfully.
         * The MP3 is the primary source; timing is an enhancement used
         * for exact ayah seek/highlight when the local SQLite DB is ready.
         * This also keeps playback working on browsers where sql.js/DB
         * loading is temporarily blocked or slow.
         */
        let timings: Mp3QuranTiming[] | null = null;
        try {
          timings = await loadGaplessTiming(
            reciter,
            surahNumber,
            url,
            surahInfo?.ayahs
          );
        } catch (error) {
          console.warn('Gapless timing unavailable; audio will still play:', error);
        }

        const timing =
          timings?.find(item => item.ayah === ayahNumber) ?? null;

        return {
          url,
          startTime: timing?.start_time,
          endTime: timing?.end_time
        };
      }
      /*
       * ===============================================
       * MP3QURAN
       * ===============================================
       */

      if (
        reciter.audioSource ===
        'mp3quran'
      ) {
        const isOfficialMp3QuranKurdish =
          reciter.category === 'kurdish' &&
          (reciter.id === 'peshawa_kurdi' ||
            reciter.id === 'ramazan_shukur');

        const isCustomKurdishAudio =
          reciter.category === 'kurdish' &&
          !isOfficialMp3QuranKurdish;

        /*
         * Each Kurdish reciter gets timing from THEIR OWN audio:
         *
         * - Peshawa/Ramazan: official MP3Quran timing for their own read.
         * - Custom GitHub Kurdish recordings: timing is derived from the
         *   exact same surah MP3, never from another reciter.
         *
         * This is deliberately separate so a missing MP3Quran record
         * cannot block or mis-time a custom Kurdish recording.
         */
        const manualTimings =
          await loadManualTiming(
            reciter.id,
            surahNumber
          );

        let timings =
          manualTimings ?? [];

        if (
          !timings.length &&
          isOfficialMp3QuranKurdish
        ) {
          timings =
            await getMp3QuranTiming(
              reciter,
              surahNumber
            );
        }

        if (
          !timings.length &&
          isCustomKurdishAudio
        ) {
          const timingUrl =
            makeMp3QuranSurahUrl(
              reciter,
              surahNumber
            );

          const surahInfo =
            surahsList.find(
              s => s.number === surahNumber
            );

          const fallbackRanges =
            timingUrl && surahInfo?.ayahs
              ? await getSilenceBasedRanges(
                  reciter.id,
                  surahNumber,
                  timingUrl,
                  surahInfo.ayahs
                )
              : null;

          timings =
            fallbackRanges?.map(
              range => ({
                ayah: range.ayah,
                start_time: range.start,
                end_time: range.end
              })
            ) ?? [];
        }

        const timing =
          timings.find(
            item =>
              item.ayah ===
              ayahNumber
          );

        /*
         * Official timing-backed Kurdish sources must have their own
         * timing row. Custom Kurdish recordings are still allowed to
         * play when timing analysis is unavailable; they simply do not
         * receive a guessed seek position.
         */
        if (
          isOfficialMp3QuranKurdish &&
          !timing
        ) {
          throw new Error(
            `کاتی ڕاستی ئەم قارییە نەدۆزرایەوە بۆ ${surahNumber}:${ayahNumber}`
          );
        }

        /*
         * For Kurdish MP3 sources that do not expose an official
         * MP3Quran timing table, derive timing from THIS exact
         * surah audio file. Never borrow another reciter's timing.
         */
        try {
          const blobKey = `${reciter.id}_${surahNumber}`;

          if (
            audioObjectUrlRef.current &&
            loadedLocalBlobKeyRef.current ===
              blobKey
          ) {
            return {
              url: audioObjectUrlRef.current,
              startTime:
                timing?.start_time,
              endTime:
                timing?.end_time
            };
          }

          const localSurah =
            await getSurahAudio(
              reciter.id,
              surahNumber
            );

          if (localSurah) {
            clearAudioObjectUrl();

            const localUrl =
              URL.createObjectURL(
                localSurah
              );

            audioObjectUrlRef.current =
              localUrl;

            loadedLocalBlobKeyRef.current =
              blobKey;

            return {
              url: localUrl,
              startTime:
                timing?.start_time,
              endTime:
                timing?.end_time
            };
          }
        } catch (error) {
          console.warn(
            'Local MP3Quran audio unavailable:',
            error
          );
        }

        /*
         * Online MP3Quran.
         */
        const onlineUrl =
          makeMp3QuranSurahUrl(
            reciter,
            surahNumber
          );

        if (!onlineUrl) {
          throw new Error(
            `URL ـی MP3Quran بۆ ${reciter.name} نەدۆزرایەوە`
          );
        }

        return {
          url: onlineUrl,
          startTime:
            timing?.start_time,
          endTime:
            timing?.end_time
        };
      }

      /*
       * ===============================================
       * EVERYAYAH
       * ===============================================
       */

      const localBlob =
        await getAyahAudio(
          reciter.id,
          surahNumber,
          ayahNumber
        ).catch(
          () => null
        );

      if (localBlob) {
        clearAudioObjectUrl();

        const localUrl =
          URL.createObjectURL(
            localBlob
          );

        audioObjectUrlRef.current =
          localUrl;

        return {
          url: localUrl
        };
      }

      const onlineUrl =
        makeEveryAyahUrl(
          reciter,
          surahNumber,
          ayahNumber
        );

      if (!onlineUrl) {
        throw new Error(
          `EveryAyah URL نەدروست بوو بۆ ${reciter.name}`
        );
      }

      return {
        url: onlineUrl
      };
    };

  /* =========================================================
     PAGE AUDIO
  ========================================================= */

  const [
    pageAudioIndex,
    setPageAudioIndex
  ] = useState(-1);

  const pageAudioIndexRef =
    useRef(-1);

  const pendingContinuousAyahRef =
    useRef<{
      surahNumber: number;
      numberInSurah: number;
    } | null>(null);

  const [
    pressingBox,
    setPressingBox
  ] = useState<string | null>(
    null
  );

  const [
    highlightedAyah,
    setHighlightedAyah
  ] = useState<{
    ayah: any;
    topPercent: number;
  } | null>(null);

  /*
   * Raad Al-Kurdi uses two independent visual states,
   * matching the original app's selection/audio model:
   * blue = user selection, green = currently playing ayah.
   * Keep this separate from highlightedAyah so playback does
   * not steal the user's selected ayah.
   */
  const [
    audioHighlightedAyah,
    setAudioHighlightedAyah
  ] = useState<{
    ayah: any;
    topPercent: number;
  } | null>(null);

  const [
    tafsirSheetOpen,
    setTafsirSheetOpen
  ] = useState(false);

  const longPressTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const longPressTriggeredRef =
    useRef(false);

  const [
    allAyahData,
    setAllAyahData
  ] = useState<
    Record<
      string,
      AyahBoxObj[]
    >
  >({});

  /* =========================================================
     AYAH DATA
  ========================================================= */

  useEffect(() => {
    fetch(
      `${import.meta.env.BASE_URL}ayahdata/ayahdata.json`
    )
      .then(res => {
        if (!res.ok) {
          throw new Error(
            'ayahdata.json not found'
          );
        }

        return res.json();
      })
      .then(data => {
        setAllAyahData(data);
      })
      .catch(() => {
        setAllAyahData({});
      });
  }, []);

  const ayahBoxes: AyahBoxObj[] =
    allAyahData[
      String(currentPage)
    ] || [];

  /* =========================================================
     AYAH BOOKMARKS
  ========================================================= */

  const [
    ayahBookmarks,
    setAyahBookmarks
  ] = useState<string[]>(
    () => {
      try {
        const saved =
          localStorage.getItem(
            'quran_ayah_bookmarks'
          );

        return saved
          ? JSON.parse(saved)
          : [];
      } catch {
        return [];
      }
    }
  );

  const ayahKey = (
    a: any
  ) =>
    `${a.surahNumber}:${a.numberInSurah}`;

  const isAyahBookmarked = (
    a: any
  ) =>
    ayahBookmarks.includes(
      ayahKey(a)
    );

  const toggleAyahBookmark = (
    a: any
  ) => {
    const key =
      ayahKey(a);

    const updated =
      isAyahBookmarked(a)
        ? ayahBookmarks.filter(
            k => k !== key
          )
        : [
            ...ayahBookmarks,
            key
          ];

    setAyahBookmarks(
      updated
    );

    localStorage.setItem(
      'quran_ayah_bookmarks',
      JSON.stringify(
        updated
      )
    );

    navigator.vibrate?.(35);
  };

  /* =========================================================
     SAVE RECITER
  ========================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        'quran_selected_reciter',
        selectedReciter.id
      );
    } catch {
      // Ignore
    }
  }, [
    selectedReciter.id
  ]);

  /* =========================================================
     RECITER SYNC
  ========================================================= */

  useEffect(() => {
    const handleReciterChanged =
      (
        event: Event
      ) => {
        const customEvent =
          event as CustomEvent<string>;

        const reciterId =
          customEvent.detail;

        if (!reciterId) {
          return;
        }

        const reciter =
          ALL_RECITERS_DIRECTORY.find(
            r =>
              r.id ===
              reciterId
          );

        if (reciter) {
          setSelectedReciter(
            reciter
          );
        }
      };

    window.addEventListener(
      'quran-reciter-changed',
      handleReciterChanged
    );

    return () => {
      window.removeEventListener(
        'quran-reciter-changed',
        handleReciterChanged
      );
    };
  }, []);

  /* =========================================================
     TAFSIR
  ========================================================= */

  const getTafsirApiEdition =
    (
      tafsir: TafsirItem
    ): string | null =>
      TAFSIR_API_EDITION[
        tafsir.id
      ] || null;

  /* =========================================================
     CURRENT SURAH
  ========================================================= */

  const currentSurah =
    surahsList
      .slice()
      .reverse()
      .find(
        s =>
          currentPage >=
          s.startPage
      ) ||
    surahsList[0];

  const currentSurahNumber =
    currentSurah?.number ||
    0;

  const currentSurahAyahCount =
    currentSurah?.ayahs ||
    0;

  /* =========================================================
     REFRESH DOWNLOAD
  ========================================================= */

  const refreshCurrentSurahDownload =
    async () => {
      if (
        !currentSurahNumber ||
        !currentSurahAyahCount
      ) {
        setSurahDownloadState({
          downloaded: 0,
          total: 0,
          downloading: false,
          paused: false,
          error: false
        });

        return;
      }

      try {
        if (
          selectedReciter.audioSource ===
          'mp3quran'
        ) {
          const downloaded =
            await isSurahAudioDownloaded(
              selectedReciter.id,
              currentSurahNumber
            );

          setSurahDownloadState(
            previous => ({
              ...previous,
              downloaded:
                downloaded
                  ? currentSurahAyahCount
                  : 0,
              total:
                currentSurahAyahCount,
              downloading: false,
              paused:
                previous.paused,
              error: false
            })
          );

          return;
        }

        const downloaded =
          await getDownloadedAyahCount(
            selectedReciter.id,
            currentSurahNumber,
            currentSurahAyahCount
          );

        setSurahDownloadState(
          previous => ({
            ...previous,
            downloaded,
            total:
              currentSurahAyahCount,
            downloading: false,
            error: false
          })
        );
      } catch (error) {
        console.error(
          'Refresh download state error:',
          error
        );

        setSurahDownloadState(
          previous => ({
            ...previous,
            total:
              currentSurahAyahCount,
            downloading: false
          })
        );
      }
    };

  /* =========================================================
     SURAH / RECITER CHANGED
  ========================================================= */

  useEffect(() => {
    downloadSessionRef.current++;

    downloadAbortControllerRef.current?.abort();

    downloadAbortControllerRef.current =
      null;

    setSurahDownloadState({
      downloaded: 0,
      total:
        currentSurahAyahCount,
      downloading: false,
      paused: false,
      error: false
    });

    void refreshCurrentSurahDownload();
  }, [
    currentSurahNumber,
    currentSurahAyahCount,
    selectedReciter.id
  ]);

  /* =========================================================
     DOWNLOAD CURRENT SURAH
  ========================================================= */

  const downloadCurrentSurah =
    async () => {
      if (
        !currentSurahNumber ||
        !currentSurahAyahCount
      ) {
        return;
      }

      if (
        surahDownloadState.downloading
      ) {
        return;
      }

      const reciterAtStart =
        selectedReciter;

      const surahNumberAtStart =
        currentSurahNumber;

      const ayahCountAtStart =
        currentSurahAyahCount;

      const session =
        ++downloadSessionRef.current;

      const controller =
        new AbortController();

      downloadAbortControllerRef.current =
        controller;

      try {
        /*
         * ===============================================
         * MP3QURAN
         * ===============================================
         */

        if (
          reciterAtStart.audioSource ===
          'mp3quran'
        ) {
          const alreadyDownloaded =
            await isSurahAudioDownloaded(
              reciterAtStart.id,
              surahNumberAtStart
            );

          if (
            alreadyDownloaded
          ) {
            if (
              session ===
                downloadSessionRef.current &&
              selectedReciter.id ===
                reciterAtStart.id
            ) {
              setSurahDownloadState({
                downloaded:
                  ayahCountAtStart,
                total:
                  ayahCountAtStart,
                downloading:
                  false,
                paused: false,
                error: false
              });
            }

            return;
          }

          const url =
            makeMp3QuranSurahUrl(
              reciterAtStart,
              surahNumberAtStart
            );

          if (!url) {
            throw new Error(
              'MP3Quran audioBaseUrl نەدۆزرایەوە'
            );
          }

          setSurahDownloadState({
            downloaded: 0,
            total:
              ayahCountAtStart,
            downloading: true,
            paused: false,
            error: false
          });

          const response =
            await fetch(url, {
              signal:
                controller.signal
            });

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}`
            );
          }

          const blob =
            await response.blob();

          if (
            controller.signal.aborted
          ) {
            throw new DOMException(
              'Download paused',
              'AbortError'
            );
          }

          if (
            blob.size === 0
          ) {
            throw new Error(
              'فایلی دەنگ بەتاڵە'
            );
          }

          await saveSurahAudio(
            reciterAtStart.id,
            surahNumberAtStart,
            blob
          );

          if (
            session ===
              downloadSessionRef.current &&
            selectedReciter.id ===
              reciterAtStart.id
          ) {
            setSurahDownloadState({
              downloaded:
                ayahCountAtStart,
              total:
                ayahCountAtStart,
              downloading:
                false,
              paused: false,
              error: false
            });

            navigator.vibrate?.([
              40,
              60,
              40
            ]);
          }

          return;
        }

        /*
         * ===============================================
         * EVERYAYAH
         * ===============================================
         */

        let currentCount =
          await getDownloadedAyahCount(
            reciterAtStart.id,
            surahNumberAtStart,
            ayahCountAtStart
          );

        if (
          session !==
          downloadSessionRef.current
        ) {
          return;
        }

        setSurahDownloadState({
          downloaded:
            currentCount,
          total:
            ayahCountAtStart,
          downloading: true,
          paused: false,
          error: false
        });

        for (
          let ayah = 1;
          ayah <=
          ayahCountAtStart;
          ayah++
        ) {
          if (
            controller.signal.aborted
          ) {
            throw new DOMException(
              'Download paused',
              'AbortError'
            );
          }

          if (
            session !==
            downloadSessionRef.current
          ) {
            return;
          }

          const existing =
            await getAyahAudio(
              reciterAtStart.id,
              surahNumberAtStart,
              ayah
            );

          if (existing) {
            continue;
          }

          const url =
            makeEveryAyahUrl(
              reciterAtStart,
              surahNumberAtStart,
              ayah
            );

          const response =
            await fetch(url, {
              signal:
                controller.signal
            });

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status} — ${url}`
            );
          }

          const blob =
            await response.blob();

          if (
            controller.signal.aborted
          ) {
            throw new DOMException(
              'Download paused',
              'AbortError'
            );
          }

          if (
            blob.size === 0
          ) {
            throw new Error(
              `فایلی ئایەتی ${ayah} بەتاڵە`
            );
          }

          await saveAyahAudio(
            reciterAtStart.id,
            surahNumberAtStart,
            ayah,
            blob
          );

          currentCount++;

          if (
            session ===
              downloadSessionRef.current &&
            selectedReciter.id ===
              reciterAtStart.id
          ) {
            setSurahDownloadState({
              downloaded:
                currentCount,
              total:
                ayahCountAtStart,
              downloading: true,
              paused: false,
              error: false
            });
          }
        }

        const finalCount =
          await getDownloadedAyahCount(
            reciterAtStart.id,
            surahNumberAtStart,
            ayahCountAtStart
          );

        if (
          session ===
            downloadSessionRef.current &&
          selectedReciter.id ===
            reciterAtStart.id
        ) {
          setSurahDownloadState({
            downloaded:
              finalCount,
            total:
              ayahCountAtStart,
            downloading: false,
            paused: false,
            error: false
          });

          navigator.vibrate?.([
            40,
            60,
            40
          ]);
        }
      } catch (error: any) {
        if (
          error?.name ===
          'AbortError'
        ) {
          let current = 0;

          if (
            reciterAtStart.audioSource ===
            'mp3quran'
          ) {
            const downloaded =
              await isSurahAudioDownloaded(
                reciterAtStart.id,
                surahNumberAtStart
              ).catch(
                () => false
              );

            current =
              downloaded
                ? ayahCountAtStart
                : 0;
          } else {
            current =
              await getDownloadedAyahCount(
                reciterAtStart.id,
                surahNumberAtStart,
                ayahCountAtStart
              ).catch(
                () => 0
              );
          }

          if (
            session ===
              downloadSessionRef.current &&
            selectedReciter.id ===
              reciterAtStart.id
          ) {
            setSurahDownloadState({
              downloaded:
                current,
              total:
                ayahCountAtStart,
              downloading:
                false,
              paused: true,
              error: false
            });
          }
        } else {
          console.error(
            'Audio download error:',
            error
          );

          let current = 0;

          if (
            reciterAtStart.audioSource ===
            'mp3quran'
          ) {
            const downloaded =
              await isSurahAudioDownloaded(
                reciterAtStart.id,
                surahNumberAtStart
              ).catch(
                () => false
              );

            current =
              downloaded
                ? ayahCountAtStart
                : 0;
          } else {
            current =
              await getDownloadedAyahCount(
                reciterAtStart.id,
                surahNumberAtStart,
                ayahCountAtStart
              ).catch(
                () => 0
              );
          }

          if (
            session ===
              downloadSessionRef.current &&
            selectedReciter.id ===
              reciterAtStart.id
          ) {
            setSurahDownloadState({
              downloaded:
                current,
              total:
                ayahCountAtStart,
              downloading:
                false,
              paused: false,
              error: true
            });

            alert(
              'دابەزاندنی دەنگ سەرکەوتوو نەبوو.\n\nلەوانەیە سەرچاوەی دەنگی ئەم قارییە بەردەست نەبێت یان ڕێگە بە دابەزاندنی ڕاستەوخۆ نەدات.'
            );
          }
        }
      } finally {
        if (
          downloadAbortControllerRef.current ===
          controller
        ) {
          downloadAbortControllerRef.current =
            null;
        }
      }
    };

  /* =========================================================
     PAUSE
  ========================================================= */

  const pauseCurrentSurahDownload =
    () => {
      downloadAbortControllerRef.current?.abort();
    };

  /* =========================================================
     DELETE
  ========================================================= */

  const removeCurrentSurahAudio =
    async () => {
      if (
        !currentSurahNumber ||
        !currentSurahAyahCount
      ) {
        return;
      }

      if (
        surahDownloadState.downloading
      ) {
        downloadAbortControllerRef.current?.abort();
      }

      const confirmed =
        window.confirm(
          appLang === 'ar'
            ? 'هل تريد حذف صوت هذه السورة؟'
            : appLang === 'en'
              ? 'Delete downloaded audio for this surah?'
              : 'دڵنیایت دەتەوێت دەنگی ئەم سورەتە بسڕیتەوە؟'
        );

      if (!confirmed) {
        return;
      }

      try {
        await deleteSurahAudio(
          selectedReciter.id,
          currentSurahNumber,
          currentSurahAyahCount
        );

        downloadSessionRef.current++;

        setSurahDownloadState({
          downloaded: 0,
          total:
            currentSurahAyahCount,
          downloading: false,
          paused: false,
          error: false
        });
      } catch (error) {
        console.error(
          'Delete audio error:',
          error
        );

        alert(
          'سڕینەوەی دەنگ سەرکەوتوو نەبوو.'
        );
      }
    };

  /* =========================================================
     DOWNLOAD PROGRESS
  ========================================================= */

  const downloadProgress =
    surahDownloadState.total >
    0
      ? Math.round(
          (surahDownloadState.downloaded /
            surahDownloadState.total) *
            100
        )
      : 0;

  const isSurahDownloadComplete =
    surahDownloadState.total >
      0 &&
    surahDownloadState.downloaded >=
      surahDownloadState.total;

  /* =========================================================
     DOWNLOAD UI
  ========================================================= */

  const renderCurrentSurahDownload =
    () => {
      if (
        !currentSurah ||
        !currentSurahNumber ||
        !currentSurahAyahCount
      ) {
        return null;
      }

      if (
        surahDownloadState.downloading
      ) {
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();

                pauseCurrentSurahDownload();
              }}
              className="h-9 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.97] transition-all"
            >
              <Pause className="w-3.5 h-3.5" />

              <span className="text-[10px] font-bold">
                وەستاندن
              </span>
            </button>

            <div className="min-w-[64px] text-center">
              <div className="text-[10px] font-bold text-amber-700">
                {downloadProgress}%
              </div>

              <div className="text-[8px] text-slate-400">
                {
                  surahDownloadState.downloaded
                }
                /
                {
                  surahDownloadState.total
                }
              </div>
            </div>
          </div>
        );
      }

      if (
        isSurahDownloadComplete
      ) {
        return (
          <div className="flex items-center gap-1.5">
            <div className="h-9 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" />

              <span className="text-[9px] font-bold">
                دابەزێندراوە
              </span>
            </div>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();

                void removeCurrentSurahAudio();
              }}
              className="h-9 px-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.97] transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />

              <span className="text-[9px] font-bold">
                سڕینەوە
              </span>
            </button>
          </div>
        );
      }

      if (
        surahDownloadState.downloaded >
        0
      ) {
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();

                void downloadCurrentSurah();
              }}
              className="h-9 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.97] transition-all"
            >
              <Play className="w-3.5 h-3.5" />

              <span className="text-[9px] font-bold">
                بەردەوامکردن
              </span>
            </button>

            <div className="min-w-[58px] text-center">
              <div className="text-[10px] font-bold text-blue-700">
                {downloadProgress}%
              </div>

              <div className="text-[8px] text-slate-400">
                {
                  surahDownloadState.downloaded
                }
                /
                {
                  surahDownloadState.total
                }
              </div>
            </div>
          </div>
        );
      }

      return (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();

            void downloadCurrentSurah();
          }}
          className="h-9 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.97] transition-all"
        >
          <Download className="w-3.5 h-3.5" />

          <span className="text-[9px] font-bold">
            دابەزاندن
          </span>
        </button>
      );
    };

  /* =========================================================
     PLAY SINGLE AYAH
  ========================================================= */

  const playAyahAudio =
    async (
      a: any
    ) => {
      const key =
        ayahKey(a);

      if (
        playingAyahKey === key
      ) {
        stopAudioCompletely();
        return;
      }

      const requestId =
        ++audioRequestIdRef.current;

      /*
       * A new ayah request immediately invalidates every
       * previous timing/highlight state. This is important
       * on pages that contain more than one surah (for example
       * page 604: 112, 113, 114), so an old green highlight
       * cannot survive while the new ayah is loading.
       */
      activeSegmentRef.current =
        null;

      gaplessActiveTimingRef.current =
        null;

      gaplessLastAyahKeyRef.current =
        null;

      estimatedTimingRef.current =
        null;

      setAudioHighlightedAyah(null);

      pageAudioIndexRef.current =
        -1;

      setPageAudioIndex(-1);

      const ayahBox =
        ayahBoxes.find(
          b =>
            b.s ===
              a.surahNumber &&
            b.a ===
              a.numberInSurah
        );

      if (ayahBox) {
        const topPct =
          (ayahBox.y0 /
            AYAH_CANVAS_HEIGHT) *
          100;

        setAudioHighlightedAyah({
          ayah: a,
          topPercent: topPct
        });
      }

      const selectedPageIndex =
        pageAyahsData.findIndex(
          item =>
            item.surahNumber === a.surahNumber &&
            item.numberInSurah === a.numberInSurah
        );

      if (selectedPageIndex >= 0) {
        pageAudioIndexRef.current =
          selectedPageIndex;
        setPageAudioIndex(
          selectedPageIndex
        );
      }

      if (
        !audioRef.current
      ) {
        return;
      }

      audioRef.current.pause();

      try {
        const source =
          await getAudioSource(
            selectedReciter,
            a.surahNumber,
            a.numberInSurah
          );

        let fallbackStartTime:
          | number
          | undefined;

        if (
          selectedReciter.audioSource ===
          'gapless'
        ) {
          const timingUrl =
            selectedReciter.audioBaseUrl
              ? `${selectedReciter.audioBaseUrl.replace(/\/+$/, '')}/${String(a.surahNumber).padStart(3, '0')}.mp3`
              : undefined;

          const surahInfo =
            surahsList.find(
              s => s.number === a.surahNumber
            );

          const timings =
            await loadGaplessTiming(
              selectedReciter,
              a.surahNumber,
              timingUrl,
              surahInfo?.ayahs
            );

          gaplessActiveTimingRef.current =
            timings
              ? {
                  surahNumber:
                    a.surahNumber,
                  timings
                }
              : null;

          // DB is authoritative; if it is unavailable, use a timeline
          // derived from this exact surah MP3 so the highlight still moves.
          if (!timings?.length && surahInfo?.ayahs) {
            const audio = audioRef.current;
            if (audio) {
              if (audio.readyState < 1) {
                await new Promise<void>((resolve, reject) => {
                  const onLoaded = () => { cleanup(); resolve(); };
                  const onError = () => { cleanup(); reject(new Error('Audio metadata load failed')); };
                  const cleanup = () => {
                    audio.removeEventListener('loadedmetadata', onLoaded);
                    audio.removeEventListener('error', onError);
                  };
                  audio.addEventListener('loadedmetadata', onLoaded);
                  audio.addEventListener('error', onError);
                });
              }
              const counts = await getSurahWordCounts(a.surahNumber);
              const ranges = buildEstimatedRanges(
                counts.slice(0, surahInfo.ayahs),
                audio.duration
              );
              if (ranges.length) {
                estimatedTimingRef.current = {
                  reciterId: selectedReciter.id,
                  surahNumber: a.surahNumber,
                  ranges
                };
                fallbackStartTime = ranges.find(
                  range => range.ayah === a.numberInSurah
                )?.start;
              }
            }
          }
        } else if (
        } else if (
          selectedReciter.audioSource ===
          'mp3quran'
        ) {
          let timings =
            await loadManualTiming(
              selectedReciter.id,
              a.surahNumber
            );

          timings =
            timings ??
            (await getMp3QuranTiming(
              selectedReciter,
              a.surahNumber
            ));

          if (
            !timings.length &&
            selectedReciter.category === 'kurdish'
          ) {
            const timingUrl =
              selectedReciter.audioBaseUrl
                ? `${selectedReciter.audioBaseUrl.replace(/\/+$/, '')}/${String(a.surahNumber).padStart(3, '0')}.mp3`
                : undefined;

            const surahInfo =
              surahsList.find(
                s => s.number === a.surahNumber
              );

            const fallbackRanges =
              timingUrl && surahInfo?.ayahs
                ? await getSilenceBasedRanges(
                    selectedReciter.id,
                    a.surahNumber,
                    timingUrl,
                    surahInfo.ayahs
                  )
                : null;

            timings =
              fallbackRanges?.map(
                range => ({
                  ayah: range.ayah,
                  start_time: range.start,
                  end_time: range.end
                })
              ) ?? [];
          }

          gaplessActiveTimingRef.current =
            timings.length
              ? {
                  surahNumber:
                    a.surahNumber,
                  timings
                }
              : null;
        }

        if (
          requestId !==
          audioRequestIdRef.current
        ) {
          return;
        }

        const audio =
          audioRef.current;

        const isSameSrc =
          !!audio.src &&
          audio.src ===
            new URL(
              source.url,
              window.location.href
            ).href;

        if (!isSameSrc) {
          audio.src =
            source.url;

          /*
           * All Kurdish surah-based sources use one MP3 per surah.
           * Force the browser to load the new source before seeking,
           * especially when two surahs share one Mushaf page.
           */
          if (
            selectedReciter.category === 'kurdish'
          ) {
            audio.load();
          }
        }

        /*
         * Rizgar Kurdi: wait for the new surah MP3 metadata before
         * seeking/playing. This makes first play reliable on mobile
         * browsers and lets the exact ayah timing seek safely.
         */
        if (
          selectedReciter.id === 'rizgar_kurdi' &&
          audio.readyState < 1
        ) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error('Rizgar audio metadata load failed'));
            };
            const cleanup = () => {
              audio.removeEventListener('loadedmetadata', onLoaded);
              audio.removeEventListener('error', onError);
            };
            audio.addEventListener('loadedmetadata', onLoaded);
            audio.addEventListener('error', onError);
          });
        }

        // Single-ayah playback must stop at the selected ayah's
        // own DB boundary. Page playback has separate end-time logic
        // in playPageAyahAtIndex().
        const singleAyahEndTime =
          source.endTime ?? null;

        activeSegmentRef.current =
          {
            endTime: singleAyahEndTime,
            requestId
          };

        /*
         * MP3Quran segment (real timing).
         */
        const playbackStartTime =
          source.startTime ??
          fallbackStartTime;

        if (
          playbackStartTime !==
          undefined
        ) {
          await new Promise<void>(
            (
              resolve,
              reject
            ) => {
              const audio =
                audioRef.current;

              if (!audio) {
                reject(
                  new Error(
                    'Audio element نەدۆزرایەوە'
                  )
                );

                return;
              }

              if (
                audio.readyState >=
                1
              ) {
                resolve();
                return;
              }

              const onLoaded =
                () => {
                  cleanup();
                  resolve();
                };

              const onError =
                () => {
                  cleanup();

                  reject(
                    new Error(
                      'Audio metadata load failed'
                    )
                  );
                };

              const cleanup =
                () => {
                  audio.removeEventListener(
                    'loadedmetadata',
                    onLoaded
                  );

                  audio.removeEventListener(
                    'error',
                    onError
                  );
                };

              audio.addEventListener(
                'loadedmetadata',
                onLoaded
              );

              audio.addEventListener(
                'error',
                onError
              );
            }
          );

          if (
            requestId !==
            audioRequestIdRef.current
          ) {
            return;
          }

          audio.currentTime =
            playbackStartTime;
        } else if (
          selectedReciter.audioSource ===
          'gapless'
        ) {
          /* No DB and no fallback timeline: keep the MP3 playable. */
        } else if (
          selectedReciter.audioSource ===
          'mp3quran'
        ) {
          /*
           * Kurdish MP3Quran/GitHub sources are timing-backed above.
           * If this branch is reached, the source has no start boundary;
           * do not invent a seek position.
           */
        }

        setPlayingAyahKey(
          key
        );

        await audio.play();

        if (
          requestId ===
          audioRequestIdRef.current
        ) {
          setIsPlayingAudio(true);
        }
      } catch (error) {
        console.error(
          'Ayah audio error:',
          {
            reciter:
              selectedReciter,
            surah:
              a.surahNumber,
            ayah:
              a.numberInSurah,
            error
          }
        );

        if (
          requestId ===
          audioRequestIdRef.current
        ) {
          setPlayingAyahKey(
            null
          );

          setIsPlayingAudio(
            false
          );

          activeSegmentRef.current =
            null;
        }
      }
    };

  /* =========================================================
     PAGE AUDIO
  ========================================================= */

  const playPageAyahAtIndex =
    async (
      index: number
    ) => {
      if (
        index < 0 ||
        index >=
          pageAyahsData.length
      ) {
        pageAudioIndexRef.current =
          -1;

        setPageAudioIndex(-1);

        setPlayingAyahKey(
          null
        );

        setIsPlayingAudio(
          false
        );

        setAudioHighlightedAyah(
          null
        );

        activeSegmentRef.current =
          null;

        return;
      }

      const ayah =
        pageAyahsData[index];

      if (!ayah) {
        return;
      }

      const requestId =
        ++audioRequestIdRef.current;

      activeSegmentRef.current =
        null;

      gaplessLastAyahKeyRef.current =
        null;

      pageAudioIndexRef.current =
        index;

      setPageAudioIndex(
        index
      );

      const key =
        ayahKey(ayah);

      setPlayingAyahKey(
        key
      );

      const ayahBox =
        ayahBoxes.find(
          b =>
            b.s ===
              ayah.surahNumber &&
            b.a ===
              ayah.numberInSurah
        );

      if (ayahBox) {
        const topPct =
          (ayahBox.y0 /
            AYAH_CANVAS_HEIGHT) *
          100;

        setAudioHighlightedAyah({
          ayah,
          topPercent: topPct
        });
      }

      if (
        !audioRef.current
      ) {
        return;
      }

      audioRef.current.pause();

      try {
        const source =
          await getAudioSource(
            selectedReciter,
            ayah.surahNumber,
            ayah.numberInSurah
          );

        if (
          selectedReciter.audioSource ===
          'gapless'
        ) {
          const timingUrl =
            selectedReciter.audioBaseUrl
              ? `${selectedReciter.audioBaseUrl.replace(/\/+$/, '')}/${String(ayah.surahNumber).padStart(3, '0')}.mp3`
              : undefined;

          const surahInfo =
            surahsList.find(
              s => s.number === ayah.surahNumber
            );

          const timings =
            await loadGaplessTiming(
              selectedReciter,
              ayah.surahNumber,
              timingUrl,
              surahInfo?.ayahs
            );

          gaplessActiveTimingRef.current =
            timings
              ? {
                  surahNumber:
                    ayah.surahNumber,
                  timings
                }
              : null;
        } else if (
          selectedReciter.audioSource ===
          'mp3quran'
        ) {
          /*
           * Use the exact MP3Quran ayah timing for page playback
           * as well, so the highlight moves with the spoken ayah.
           */
          let timings =
            await loadManualTiming(
              selectedReciter.id,
              ayah.surahNumber
            );

          timings =
            timings ??
            (await getMp3QuranTiming(
              selectedReciter,
              ayah.surahNumber
            ));

          if (
            !timings.length &&
            selectedReciter.category === 'kurdish'
          ) {
            const timingUrl =
              selectedReciter.audioBaseUrl
                ? `${selectedReciter.audioBaseUrl.replace(/\/+$/, '')}/${String(ayah.surahNumber).padStart(3, '0')}.mp3`
                : undefined;

            const surahInfo =
              surahsList.find(
                s => s.number === ayah.surahNumber
              );

            const fallbackRanges =
              timingUrl && surahInfo?.ayahs
                ? await getSilenceBasedRanges(
                    selectedReciter.id,
                    ayah.surahNumber,
                    timingUrl,
                    surahInfo.ayahs
                  )
                : null;

            timings =
              fallbackRanges?.map(
                range => ({
                  ayah: range.ayah,
                  start_time: range.start,
                  end_time: range.end
                })
              ) ?? [];
          }

          gaplessActiveTimingRef.current =
            timings.length
              ? {
                  surahNumber:
                    ayah.surahNumber,
                  timings
                }
              : null;
        }

        if (
          requestId !==
          audioRequestIdRef.current
        ) {
          return;
        }

        const audio =
          audioRef.current;

        const isSameSrc =
          !!audio.src &&
          audio.src ===
            new URL(
              source.url,
              window.location.href
            ).href;

        if (!isSameSrc) {
          audio.src =
            source.url;

          /*
           * All Kurdish surah-based sources use one MP3 per surah.
           * Force the browser to load the new source before seeking,
           * especially when two surahs share one Mushaf page.
           */
          if (
            selectedReciter.category === 'kurdish'
          ) {
            audio.load();
          }
        }

        /*
         * Rizgar Kurdi: wait for the new surah MP3 metadata before
         * seeking/playing so its exact timing can be applied reliably.
         */
        if (
          selectedReciter.id === 'rizgar_kurdi' &&
          audio.readyState < 1
        ) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error('Rizgar audio metadata load failed'));
            };
            const cleanup = () => {
              audio.removeEventListener('loadedmetadata', onLoaded);
              audio.removeEventListener('error', onError);
            };
            audio.addEventListener('loadedmetadata', onLoaded);
            audio.addEventListener('error', onError);
          });
        }

        /*
         * Raad gapless playback is one continuous surah MP3.
         * For page playback we must NOT stop at the selected ayah;
         * let the same audio run until the last ayah visible on
         * this page, while the timing DB moves the green highlight
         * from ayah to ayah.
         */
        let pageAudioEndTime = source.endTime ?? null;
        let pageFallbackStartTime:
          | number
          | undefined;

        if (
          selectedReciter.audioSource === 'gapless' &&
          !gaplessActiveTimingRef.current?.timings.length
        ) {
          const surahInfo =
            surahsList.find(
              s => s.number === ayah.surahNumber
            );
          const audioForFallback = audioRef.current;
          if (surahInfo?.ayahs && audioForFallback) {
            if (audioForFallback.readyState < 1) {
              await new Promise<void>((resolve, reject) => {
                const onLoaded = () => { cleanup(); resolve(); };
                const onError = () => { cleanup(); reject(new Error('Audio metadata load failed')); };
                const cleanup = () => {
                  audioForFallback.removeEventListener('loadedmetadata', onLoaded);
                  audioForFallback.removeEventListener('error', onError);
                };
                audioForFallback.addEventListener('loadedmetadata', onLoaded);
                audioForFallback.addEventListener('error', onError);
              });
            }
            const counts = await getSurahWordCounts(ayah.surahNumber);
            const ranges = buildEstimatedRanges(
              counts.slice(0, surahInfo.ayahs),
              audioForFallback.duration
            );
            if (ranges.length) {
              estimatedTimingRef.current = {
                reciterId: selectedReciter.id,
                surahNumber: ayah.surahNumber,
                ranges
              };
              pageFallbackStartTime = ranges.find(
                range => range.ayah === ayah.numberInSurah
              )?.start;
            }
          }
        }

        if (
          (selectedReciter.audioSource === 'gapless' ||
            selectedReciter.audioSource === 'mp3quran') &&
          gaplessActiveTimingRef.current?.surahNumber ===
            ayah.surahNumber
        ) {
          const sameSurahPageAyahs = pageAyahsData.filter(
            item => item.surahNumber === ayah.surahNumber
          );

          const lastPageAyah =
            sameSurahPageAyahs[sameSurahPageAyahs.length - 1];

          const lastPageTiming =
            gaplessActiveTimingRef.current?.timings.find(
              item => item.ayah === lastPageAyah?.numberInSurah
            );

          pageAudioEndTime =
            lastPageTiming?.end_time ?? null;
        }

        activeSegmentRef.current = {
          endTime: pageAudioEndTime,
          requestId
        };

        const pagePlaybackStartTime =
          source.startTime ??
          pageFallbackStartTime;

        if (
          pagePlaybackStartTime !==
          undefined
        ) {
          await new Promise<void>(
            (
              resolve,
              reject
            ) => {
              const audio =
                audioRef.current;

              if (!audio) {
                reject(
                  new Error(
                    'Audio element نەدۆزرایەوە'
                  )
                );

                return;
              }

              if (
                audio.readyState >=
                1
              ) {
                resolve();
                return;
              }

              const onLoaded =
                () => {
                  cleanup();
                  resolve();
                };

              const onError =
                () => {
                  cleanup();

                  reject(
                    new Error(
                      'Audio metadata load failed'
                    )
                  );
                };

              const cleanup =
                () => {
                  audio.removeEventListener(
                    'loadedmetadata',
                    onLoaded
                  );

                  audio.removeEventListener(
                    'error',
                    onError
                  );
                };

              audio.addEventListener(
                'loadedmetadata',
                onLoaded
              );

              audio.addEventListener(
                'error',
                onError
              );
            }
          );

          if (
            requestId !==
            audioRequestIdRef.current
          ) {
            return;
          }

          audio.currentTime =
            pagePlaybackStartTime;
        } else if (
          selectedReciter.audioSource ===
          'gapless'
        ) {
          /* DB timing unavailable: keep audio playable. */
        }

        await audio.play();

        if (
          requestId ===
            audioRequestIdRef.current &&
          pageAudioIndexRef.current ===
            index
        ) {
          setIsPlayingAudio(true);
        }

                estimatedTimingRef.current =
          null;
      } catch (error) {
        console.error(
          'Page audio error:',
          error,
          {
            reciter: selectedReciter,
            surah: ayah.surahNumber,
            ayah: ayah.numberInSurah,
            error
          }
        );
      }


        if (
          requestId ===
          audioRequestIdRef.current
        ) {
          setIsPlayingAudio(
            false
          );

          setPlayingAyahKey(
            null
          );

          activeSegmentRef.current =
            null;
        }
      }

  /* =========================================================
     SHARE
  ========================================================= */

  const shareAyah = async (
    a: any
  ) => {
    const text =
      `${a.arabic}\n\n` +
      `(${a.surahNumber}:${a.numberInSurah})\n\n` +
      `${a.tafsir}`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          text
        });
      } else {
        await navigator.clipboard.writeText(
          text
        );
      }
    } catch {
      // Cancelled
    }
  };

  /* =========================================================
     LONG PRESS
  ========================================================= */

  const startLongPress = (
    boxKey: string,
    ayah: any,
    topPercent: number
  ) => {
    longPressTriggeredRef.current =
      false;

    setPressingBox(
      boxKey
    );

    if (
      longPressTimer.current
    ) {
      clearTimeout(
        longPressTimer.current
      );
    }

    longPressTimer.current =
      setTimeout(() => {
        longPressTriggeredRef.current =
          true;

        /*
         * Ayah interaction is intentionally long-press only.
         * A short tap must NOT start playback.
         *
         * The exact ayah (surahNumber + numberInSurah) is sent
         * directly to the same playback pipeline used everywhere
         * else, so the selected ayah and the playing ayah cannot
         * drift apart on shared-surah pages.
         */
        setHighlightedAyah({
          ayah,
          topPercent
        });

        setPressingBox(
          null
        );

        setTafsirSheetOpen(
          false
        );

        navigator.vibrate?.(40);

        void playAyahAudio(ayah);
      }, LONG_PRESS_MS);
  };

  const cancelLongPress =
    () => {
      if (
        longPressTimer.current
      ) {
        clearTimeout(
          longPressTimer.current
        );

        longPressTimer.current =
          null;
      }

      setPressingBox(
        null
      );
    };

  const closeHighlight =
    () => {
      setHighlightedAyah(
        null
      );

      setTafsirSheetOpen(
        false
      );
    };

  /* =========================================================
     SCROLL
  ========================================================= */

  const scrollContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const isUpdating =
    useRef(false);

  const pageRefs =
    useRef<
      Record<
        number,
        HTMLDivElement | null
      >
    >({});

  const isFirstScroll =
    useRef(true);

  const scrollInitiatedByUser =
    useRef(false);

  const isBookmarked =
    bookmarks.includes(
      currentPage
    );

  const currentJuz =
    Math.ceil(
      currentPage / 20
    );

  /* =========================================================
     PAGE DATA
  ========================================================= */

  useEffect(() => {
    let cancelled =
      false;

    async function loadPageVerses() {
      setLoadingTafsir(
        true
      );

      setAyahApiError(
        null
      );

      setTafsirApiError(
        null
      );

      let arabicAyahs:
        any[] = [];

      try {
        const resAr =
          await fetch(
            `https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`
          );

        const dataAr =
          await resAr.json();

        if (
          dataAr.code ===
            200 &&
          dataAr.data?.ayahs
        ) {
          arabicAyahs =
            dataAr.data.ayahs;
        } else {
          setAyahApiError(
            `arabic code:${dataAr.code}`
          );
        }
      } catch (e: any) {
        setAyahApiError(
          e?.message ||
            'arabic fetch failed'
        );
      }

      let tafsirAyahs:
        any[] = [];

      const selectedEdition =
        getTafsirApiEdition(
          selectedTafsir
        );

      if (
        selectedEdition
      ) {
        try {
          const resTf =
            await fetch(
              `https://api.alquran.cloud/v1/page/${currentPage}/${selectedEdition}`
            );

          const dataTf =
            await resTf.json();

          if (
            dataTf.code ===
              200 &&
            dataTf.data?.ayahs
          ) {
            tafsirAyahs =
              dataTf.data.ayahs;
          } else {
            setTafsirApiError(
              `tafsir code:${dataTf.code}`
            );
          }
        } catch (e: any) {
          setTafsirApiError(
            e?.message ||
              'tafsir fetch failed'
          );
        }
      } else {
        setTafsirApiError(
          'ئەم تەفسیرە هێشتا سەرچاوەی API ـی ئەپەکە نییە.'
        );
      }

      if (cancelled) {
        return;
      }

      if (
        arabicAyahs.length >
        0
      ) {
        const combined =
          arabicAyahs.map(
            (a: any) => {
              const matchingTafsir =
                tafsirAyahs.find(
                  (t: any) =>
                    t.surah?.number ===
                      a.surah.number &&
                    t.numberInSurah ===
                      a.numberInSurah
                );

              return {
                surahNumber:
                  a.surah.number,
                numberInSurah:
                  a.numberInSurah,
                arabic:
                  a.text,
                tafsir:
                  matchingTafsir?.text ||
                  (selectedEdition
                    ? 'دەقی ئەم تەفسیرە بۆ ئەم ئایەتە بەردەست نییە.'
                    : 'ئەم تەفسیرە هێشتا بە سەرچاوەی API ـی ئەپەکە نەبەستراوەتەوە.')
              };
            }
          );

        setPageAyahsData(
          combined
        );
      } else {
        setPageAyahsData(
          []
        );
      }

      setLoadingTafsir(
        false
      );
    }

    loadPageVerses();

    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    selectedTafsir.id
  ]);

  /* =========================================================
     UPDATE HIGHLIGHT
  ========================================================= */

  useEffect(() => {
    if (
      !highlightedAyah
    ) {
      return;
    }

    const updatedAyah =
      pageAyahsData.find(
        a =>
          a.surahNumber ===
            highlightedAyah.ayah
              .surahNumber &&
          a.numberInSurah ===
            highlightedAyah.ayah
              .numberInSurah
      );

    if (
      updatedAyah
    ) {
      setHighlightedAyah(
        previous =>
          previous
            ? {
                ...previous,
                ayah:
                  updatedAyah
              }
            : null
      );
    }
  }, [
    pageAyahsData
  ]);

  useEffect(() => {
    const pending =
      pendingContinuousAyahRef.current;

    if (
      !pending ||
      !pageAyahsData.length
    ) {
      return;
    }

    const index =
      pageAyahsData.findIndex(
        item =>
          item.surahNumber ===
            pending.surahNumber &&
          item.numberInSurah ===
            pending.numberInSurah
      );

    if (index < 0) {
      return;
    }

    pendingContinuousAyahRef.current =
      null;

    void playPageAyahAtIndex(
      index
    );
  }, [
    currentPage,
    pageAyahsData
  ]);

  /* =========================================================
     PAGE AUDIO RESET
  ========================================================= */

  useEffect(() => {
    stopAudioCompletely();
    setAudioHighlightedAyah(null);

    closeHighlight();
    cancelLongPress();
  }, [
    currentPage
  ]);

  /* =========================================================
     RECITER RESET
  ========================================================= */

  useEffect(() => {
    stopAudioCompletely();

    /*
     * Timing cache stays available,
     * but the currently playing source
     * must always stop.
     */
  }, [
    selectedReciter.id
  ]);

  /* =========================================================
     CLEANUP
  ========================================================= */

  useEffect(() => {
    return () => {
      audioRequestIdRef.current++;

      activeSegmentRef.current =
        null;

      if (
        audioRef.current
      ) {
        try {
          audioRef.current.pause();
          audioRef.current.removeAttribute(
            'src'
          );
          audioRef.current.load();
        } catch {
          // Ignore
        }
      }

      clearAudioObjectUrl();

      downloadAbortControllerRef.current?.abort();

      if (
        longPressTimer.current
      ) {
        clearTimeout(
          longPressTimer.current
        );
      }
    };
  }, []);

  /* =========================================================
     SCROLL TO CURRENT PAGE
  ========================================================= */

  useEffect(() => {
    if (
      scrollInitiatedByUser.current
    ) {
      scrollInitiatedByUser.current =
        false;

      return;
    }

    const scrollToTarget =
      () => {
        const el =
          pageRefs.current[
            currentPage
          ];

        if (el) {
          isUpdating.current =
            true;

          el.scrollIntoView({
            behavior:
              isFirstScroll.current
                ? 'auto'
                : 'smooth',
            inline: 'center',
            block: 'nearest'
          });

          isFirstScroll.current =
            false;

          setTimeout(
            () => {
              isUpdating.current =
                false;
            },
            400
          );
        }
      };

    if (
      isFirstScroll.current
    ) {
      const raf1 =
        requestAnimationFrame(
          () => {
            requestAnimationFrame(
              () => {
                scrollToTarget();

                setTimeout(
                  () => {
                    const el =
                      pageRefs.current[
                        currentPage
                      ];

                    const container =
                      scrollContainerRef.current;

                    if (
                      el &&
                      container
                    ) {
                      const elRect =
                        el.getBoundingClientRect();

                      const containerRect =
                        container.getBoundingClientRect();

                      const isVisible =
                        elRect.left >=
                          containerRect.left -
                            5 &&
                        elRect.right <=
                          containerRect.right +
                            5;

                      if (
                        !isVisible
                      ) {
                        el.scrollIntoView(
                          {
                            behavior:
                              'auto',
                            inline:
                              'center',
                            block:
                              'nearest'
                          }
                        );
                      }
                    }
                  },
                  250
                );
              }
            );
          }
        );

      return () =>
        cancelAnimationFrame(
          raf1
        );
    }

    scrollToTarget();
  }, [
    currentPage
  ]);

  /* =========================================================
     TOGGLE PAGE AUDIO
  ========================================================= */

  const togglePageAudio =
    () => {
      if (
        isPlayingAudio
      ) {
        audioRef.current?.pause();

        setIsPlayingAudio(
          false
        );

        return;
      }

      if (
        pageAudioIndexRef.current >=
          0 &&
        pageAudioIndexRef.current <
          pageAyahsData.length
      ) {
        const index =
          pageAudioIndexRef.current;

        if (
          audioRef.current &&
          audioRef.current.src
        ) {
          audioRef.current
            .play()
            .then(() => {
              setIsPlayingAudio(
                true
              );
            })
            .catch(() => {
              setIsPlayingAudio(
                false
              );
            });

          return;
        }

        void playPageAyahAtIndex(
          index
        );

        return;
      }

      if (
        pageAyahsData.length >
        0
      ) {
        void playPageAyahAtIndex(
          0
        );
      }
    };

  /* =========================================================
     TIME UPDATE
  ========================================================= */

  const handleAudioTimeUpdate =
    () => {
      const segment =
        activeSegmentRef.current;

      const audio =
        audioRef.current;

      if (!audio) {
        return;
      }

      /*
       * Gapless: the official timing DB gives exact ayah
       * boundaries. Keep the visual highlight synchronized
       * with the real playback position even while the
       * current ayah segment is active.
       */
      const gapless =
        gaplessActiveTimingRef.current;

      if (
        (selectedReciter.audioSource ===
          'gapless' ||
          selectedReciter.audioSource ===
            'mp3quran') &&
        gapless &&
        pageAyahsData.some(
          item =>
            item.surahNumber ===
            gapless.surahNumber
        )
      ) {
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
