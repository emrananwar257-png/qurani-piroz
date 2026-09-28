import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import initSqlJs from 'sql.js';
import { ALL_RECITERS_DIRECTORY } from '../../data/recitersList';
import {
  getAyahBoxesForPage,
  type AyahCoordinate,
} from '../../data/ayahCoordinates';

const PAGE_COUNT = 604;
const AYAH_CANVAS_WIDTH = 1260;
const AYAH_CANVAS_HEIGHT = 2020;

const QURAN_PAGE_BASE =
  'https://android.quran.com/data/width_1260/';

const QURAN_API_BASE =
  'https://api.alquran.cloud/v1';

const MP3QURAN_API_BASE =
  'https://mp3quran.net/api/v3';

const RIZGAR_RECITER_ID = 'rizgar_kurdi';
const RIZGAR_AUDIO_BASE =
  'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/rzgar_kurdi_mutasil/';

const RECITERS_CACHE_KEY =
  'quran_dynamic_kurdish_reciters_v2';

const TIMING_CACHE_KEY =
  'quran_mp3quran_timing_v2';

const RAAD_RECITER_ID = 'raad_kurdi';
const RAAD_TIMING_CACHE_KEY = 'quran_raad_kurdi_timing_v1';
const SQL_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm';

interface AyahData {
  number?: number;
  ayah?: number;
  globalAyah?: number;
  text?: string;
  surahNumber?: number;
  [key: string]: unknown;
}

interface TimingRow {
  ayah: number;
  start: number;
  end: number;
  surah?: number;
}

interface DynamicReciter {
  id: string;
  sourceId: string;
  name: string;
  nameAr?: string;
  riwayah: string;
  server: string;
  surahList: number[];
  surahTotal: number;
  moshafId: string;
  source: 'mp3quran' | 'direct';
}

interface SurahItem {
  number?: number;
  id?: number;
  name?: string;
  englishName?: string;
  startPage?: number;
  page?: number;
  endPage?: number;
  [key: string]: unknown;
}

interface QuranReaderProps {
  currentPage: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onBackToIndex: () => void;
  bgStyle?: React.CSSProperties;
  appLang: string;
  showNumbers: boolean;
  surahsList?: SurahItem[];
  onJumpToPage?: (page: number) => void;
}

interface Mp3Reciter {
  id?: number | string;
  name?: string;
  letter?: string;
  moshaf?: Array<{
    id?: number | string;
    name?: string;
    server?: string;
    surah_total?: number | string;
    surah_list?: string;
    moshaf_type?: number | string;
  }>;
}

const KURDISH_RECITER_ALIASES: Array<{
  id: string;
  aliases: string[];
  kurdishName: string;
}> = [
  {
    id: RIZGAR_RECITER_ID,
    aliases: [
      'rizgar muhammad kurdi',
      'rizgar kurdi',
      'rzgar kurdi',
      'رزگار محمد الکردي',
      'رزگار کوردی',
      'ڕزگار محمد کوردی',
      'ڕزگار کوردی',
    ],
    kurdishName: 'ڕزگار محەمەد کوردی',
  },
  {
    id: 'peshawa_kurdi',
    aliases: [
      'peshawa qadr al-kurdi',
      'peshawa kurdi',
      'peshawa',
      'بيشة وا قادر الكردي',
      'بيشةوا قادر الكردي',
    ],
    kurdishName: 'پێشەوا قادر کوردی',
  },
  {
    id: 'raad_kurdi',
    aliases: [
      'raad al kurdi',
      'raad al-kurdi',
      'raad kurdi',
      'رعد محمد الكردي',
      'رعد الكردي',
    ],
    kurdishName: 'ڕەعد کوردی',
  },
  {
    id: 'ramadan_shakoor',
    aliases: [
      'ramadan shakoor',
      'ramadan shakur',
      'رمضان شكور',
    ],
    kurdishName: 'ڕەمەزان شاکور',
  },
  {
    id: 'shirazad_taher',
    aliases: [
      'shirazad taher',
      'shirzad taher',
      'شيرزاد عبدالرحمن طاهر',
      'شيرزاد طاهر',
    ],
    kurdishName: 'شێرزاد تاهر',
  },
  {
    id: 'wishear_hayder_arbili',
    aliases: [
      'wishear hayder arbili',
      'wishear haydar arbili',
      'وشيار حيدر اربيلي',
      'وشيار حيدر أربيلي',
    ],
    kurdishName: 'ویشیار حەیدەر ئەربیلی',
  },
];

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeUrl = (url: string): string =>
  url.endsWith('/') ? url : `${url}/`;

const parseSurahList = (value: unknown): number[] => {
  if (typeof value !== 'string') return [];

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter(
      (item) =>
        Number.isInteger(item) &&
        item >= 1 &&
        item <= 114,
    );
};

const readJsonCache = <T,>(
  key: string,
): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonCache = (
  key: string,
  value: unknown,
) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Ignore storage errors.
  }
};

const formatPageNum = (page: number): string =>
  String(page).padStart(3, '0');

const pageImgUrl = (page: number): string =>
  `${QURAN_PAGE_BASE}page${formatPageNum(page)}.png`;

const normalizeTimingValue = (
  value: unknown,
): number => {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }

  return n > 10000 ? n / 1000 : n;
};

const getPageSurahNumber = (
  page: number,
  surahsList?: SurahItem[],
): number => {
  if (!surahsList?.length) {
    return 1;
  }

  const normalized = surahsList
    .map((surah) => ({
      number: Number(surah.number ?? surah.id ?? 0),
      startPage: Number(
        surah.startPage ??
          surah.page ??
          surah['start_page'] ??
          0,
      ),
      endPage: Number(
        surah.endPage ??
          surah['end_page'] ??
          0,
      ),
    }))
    .filter(
      (surah) =>
        surah.number >= 1 &&
        surah.number <= 114 &&
        surah.startPage > 0,
    )
    .sort(
      (a, b) =>
        a.startPage - b.startPage,
    );

  const inRange = normalized.find(
    (surah) =>
      page >= surah.startPage &&
      (!surah.endPage ||
        page <= surah.endPage),
  );

  if (inRange) {
    return inRange.number;
  }

  let result = normalized[0]?.number ?? 1;

  for (const surah of normalized) {
    if (surah.startPage <= page) {
      result = surah.number;
    } else {
      break;
    }
  }

  return result;
};

const findKurdishAlias = (
  name: string,
) => {
  const normalized = normalizeText(name);

  return KURDISH_RECITER_ALIASES.find(
    (entry) =>
      entry.aliases.some(
        (alias) =>
          normalized === normalizeText(alias) ||
          normalized.includes(
            normalizeText(alias),
          ) ||
          normalizeText(alias).includes(
            normalized,
          ),
      ),
  );
};

const chooseBestMoshaf = (
  moshaf: Mp3Reciter['moshaf'],
) => {
  if (!Array.isArray(moshaf)) {
    return null;
  }

  const usable = moshaf
    .filter(
      (item) =>
        item?.server &&
        parseSurahList(
          item?.surah_list,
        ).length > 0,
    )
    .sort((a, b) => {
      const aCount =
        parseSurahList(
          a?.surah_list,
        ).length;

      const bCount =
        parseSurahList(
          b?.surah_list,
        ).length;

      return bCount - aCount;
    });

  return usable[0] ?? null;
};

const makeRizgarReciter = (): DynamicReciter => ({
  id: RIZGAR_RECITER_ID,
  sourceId: RIZGAR_RECITER_ID,
  name: 'ڕزگار محەمەد کوردی',
  nameAr: 'Rizgar Muhammad Kurdi',
  riwayah: 'حفص',
  server: RIZGAR_AUDIO_BASE,
  surahList: Array.from({ length: 114 }, (_, index) => index + 1),
  surahTotal: 114,
  moshafId: RIZGAR_RECITER_ID,
  source: 'direct',
});

async function fetchRizgarTiming(
  surahNumber: number,
): Promise<TimingRow[]> {
  return fetchRizgarTimingFromDb(surahNumber);
}

async function fetchDynamicKurdishReciters(): Promise<
  DynamicReciter[]
> {
  const response = await fetch(
    `${MP3QURAN_API_BASE}/reciters?language=eng`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(
      `MP3Quran reciters API: ${response.status}`,
    );
  }

  const json = await response.json();

  const reciters: Mp3Reciter[] =
    Array.isArray(json)
      ? json
      : Array.isArray(json?.reciters)
        ? json.reciters
        : Array.isArray(json?.data)
          ? json.data
          : [];

  const result: DynamicReciter[] = [
    makeRizgarReciter(),
    makeRaadReciter(),
  ];

  for (const reciter of reciters) {
    if (findKurdishAlias(String(reciter?.name ?? ''))?.id === RIZGAR_RECITER_ID) continue;

    const name = String(
      reciter?.name ?? '',
    ).trim();

    if (!name) continue;

    const alias = findKurdishAlias(name);

    if (!alias) continue;

    const moshaf =
      chooseBestMoshaf(
        reciter?.moshaf,
      );

    if (!moshaf?.server) continue;

    const surahList = parseSurahList(
      moshaf.surah_list,
    );

    if (!surahList.length) continue;

    result.push({
      id: alias.id,
      sourceId: String(
        reciter.id ?? alias.id,
      ),
      name: alias.kurdishName,
      nameAr: name,
      riwayah: 'حفص',
      server: normalizeUrl(
        String(moshaf.server),
      ),
      surahList,
      surahTotal: surahList.length,
      moshafId: String(
        moshaf.id ??
          reciter.id ??
          alias.id,
      ),
      source: 'mp3quran',
    });
  }

  const unique = new Map<
    string,
    DynamicReciter
  >();

  for (const item of result) {
    const old = unique.get(item.id);

    if (
      !old ||
      item.surahTotal > old.surahTotal
    ) {
      unique.set(item.id, item);
    }
  }

  const ordered = [
    unique.get(RIZGAR_RECITER_ID),
    unique.get(RAAD_RECITER_ID),
    ...KURDISH_RECITER_ALIASES
      .filter(
        (alias) =>
          alias.id !== RIZGAR_RECITER_ID &&
          alias.id !== RAAD_RECITER_ID,
      )
      .map((alias) =>
        unique.get(alias.id),
      )
      .filter(
        (
          item,
        ): item is DynamicReciter =>
          Boolean(item),
      ),
  ].filter(
    (
      item,
    ): item is DynamicReciter =>
      Boolean(item),
  );

  if (!ordered.length) {
    throw new Error(
      'هیچ قارییەکی کورد لە MP3Quran نەدۆزرایەوە.',
    );
  }

  writeJsonCache(
    RECITERS_CACHE_KEY,
    ordered,
  );

  return ordered;
}

async function fetchPageAyahs(
  page: number,
): Promise<AyahData[]> {
  const response = await fetch(
    `${QURAN_API_BASE}/page/${page}/editions/quran-uthmani`,
    {
      cache: 'force-cache',
    },
  );

  if (!response.ok) {
    throw new Error(
      `Quran text API: ${response.status}`,
    );
  }

  const json = await response.json();

  const edition = Array.isArray(
    json?.data,
  )
    ? json.data[0]
    : json?.data;

  const ayahs = Array.isArray(
    edition?.ayahs,
  )
    ? edition.ayahs
    : [];

  return ayahs.map(
    (ayah: any) => ({
      ...ayah,
      globalAyah: Number(
        ayah?.number ?? 0,
      ),
      ayah: Number(
        ayah?.numberInSurah ??
          ayah?.ayah ??
          0,
      ),
      surahNumber: Number(
        ayah?.surah?.number ??
          ayah?.surahNumber ??
          0,
      ),
    }),
  );
}

async function fetchMp3QuranTiming(
  readId: string,
  surahNumber: number,
): Promise<TimingRow[]> {
  const cacheKey =
    `${TIMING_CACHE_KEY}:${readId}:${surahNumber}`;

  const cached =
    readJsonCache<TimingRow[]>(
      cacheKey,
    );

  if (
    Array.isArray(cached) &&
    cached.length
  ) {
    return cached;
  }

  const url =
    `${MP3QURAN_API_BASE}/ayat_timing` +
    `?surah=${encodeURIComponent(
      String(surahNumber),
    )}` +
    `&read=${encodeURIComponent(
      String(readId),
    )}`;

  const response = await fetch(
    url,
    {
      cache: 'force-cache',
    },
  );

  if (!response.ok) {
    throw new Error(
      `MP3Quran timing API: ${response.status}`,
    );
  }

  const json = await response.json();

  const rows = Array.isArray(json)
    ? json
    : Array.isArray(json?.ayat)
      ? json.ayat
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.timing)
          ? json.timing
          : Array.isArray(json?.ayahs)
            ? json.ayahs
            : [];

  const timings: TimingRow[] =
    rows
      .map(
        (row: any, index: number) => ({
          ayah: Number(
            row?.ayah ??
              row?.ayah_number ??
              row?.number ??
              index + 1,
          ),
          start:
            normalizeTimingValue(
              row?.start_time ??
                row?.start ??
                0,
            ),
          end:
            normalizeTimingValue(
              row?.end_time ??
                row?.end ??
                0,
            ),
        }),
      )
      .filter(
        (row: TimingRow) =>
          Number.isFinite(row.ayah) &&
          row.ayah >= 1 &&
          row.end >= row.start,
      );

  if (timings.length) {
    writeJsonCache(
      cacheKey,
      timings,
    );
  }

  return timings;
}

const makeSurahAudioUrl = (
  reciter: DynamicReciter,
  surahNumber: number,
): string =>
  `${normalizeUrl(
    reciter.server,
  )}${String(surahNumber).padStart(
    3,
    '0',
  )}.mp3`;

const makeRaadReciter = (): DynamicReciter => {
  const config = ALL_RECITERS_DIRECTORY.find(
    (item) => item.id === RAAD_RECITER_ID,
  );

  if (!config?.audioBaseUrl || !config.timingDbUrl) {
    throw new Error('زانیارییەکانی ڕەعد کوردی لە recitersList نەدۆزرایەوە.');
  }

  return {
    id: RAAD_RECITER_ID,
    sourceId: RAAD_RECITER_ID,
    name: config.name,
    nameAr: config.subName,
    riwayah: config.riwayah,
    server: config.audioBaseUrl,
    surahList: config.availableSurahs?.length
      ? config.availableSurahs
      : Array.from({ length: 114 }, (_, index) => index + 1),
    surahTotal: config.availableSurahs?.length ?? 114,
    moshafId: RAAD_RECITER_ID,
    source: 'direct',
  };
};

let raadTimingRowsPromise: Promise<TimingRow[]> | null = null;

const normalizeColumnName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const pickTimingColumn = (
  columns: string[],
  candidates: string[],
) => {
  const normalized = new Map(
    columns.map((column) => [
      normalizeColumnName(column),
      column,
    ]),
  );

  for (const candidate of candidates) {
    const found = normalized.get(
      normalizeColumnName(candidate),
    );
    if (found) return found;
  }

  return null;
};

const loadRaadTimingRows = async (): Promise<TimingRow[]> => {
  if (raadTimingRowsPromise) {
    return raadTimingRowsPromise;
  }

  raadTimingRowsPromise = (async () => {
    const config = ALL_RECITERS_DIRECTORY.find(
      (item) => item.id === RAAD_RECITER_ID,
    );

    if (!config?.timingDbUrl) {
      throw new Error('timingDbUrl ـی ڕەعد کوردی نییە.');
    }

    const response = await fetch(config.timingDbUrl, {
      cache: 'force-cache',
    });

    if (!response.ok) {
      throw new Error(
        `Raad timing DB: ${response.status}`,
      );
    }

    const buffer = await response.arrayBuffer();

    const SQL = await initSqlJs({
      locateFile: () => SQL_WASM_URL,
    });

    const db = new SQL.Database(
      new Uint8Array(buffer),
    );

    try {
      const tablesResult = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );

      const tableNames =
        tablesResult[0]?.values
          .map((row) => String(row[0]))
          .filter(Boolean) ?? [];

      const allRows: TimingRow[] = [];

      for (const tableName of tableNames) {
        const safeTableName = tableName.replace(/"/g, '""');

        let infoResult: any[];
        try {
          infoResult = db.exec(
            `PRAGMA table_info("${safeTableName}")`,
          );
        } catch {
          continue;
        }

        const columns =
          infoResult[0]?.values
            .map((row) => String(row[1]))
            .filter(Boolean) ?? [];

        const surahColumn = pickTimingColumn(
          columns,
          [
            'surah',
            'sura',
            'surah_number',
            'sura_number',
            'chapter',
            'chapter_number',
          ],
        );

        const ayahColumn = pickTimingColumn(
          columns,
          [
            'ayah',
            'aya',
            'ayah_number',
            'aya_number',
            'verse',
            'verse_number',
          ],
        );

        const startColumn = pickTimingColumn(
          columns,
          [
            'start',
            'start_time',
            'start_ms',
            'starttime',
            'from',
            'begin',
            'begin_time',
          ],
        );

        const endColumn = pickTimingColumn(
          columns,
          [
            'end',
            'end_time',
            'end_ms',
            'endtime',
            'to',
            'finish',
            'finish_time',
          ],
        );

        if (
          !surahColumn ||
          !ayahColumn ||
          !startColumn ||
          !endColumn
        ) {
          continue;
        }

        const quote = (column: string) =>
          `"${column.replace(/"/g, '""')}"`;

        let result: any[];
        try {
          result = db.exec(
            `SELECT ${quote(surahColumn)}, ${quote(ayahColumn)}, ${quote(startColumn)}, ${quote(endColumn)} FROM "${safeTableName}"`,
          );
        } catch {
          continue;
        }

        const rows = result[0];
        if (!rows) continue;

        for (const row of rows.values) {
          const surah = Number(row[0]);
          const ayah = Number(row[1]);
          const startRaw = Number(row[2]);
          const endRaw = Number(row[3]);
          const start =
            Number.isFinite(startRaw) && startRaw > 1000
              ? startRaw / 1000
              : startRaw;
          const end =
            Number.isFinite(endRaw) && endRaw > 1000
              ? endRaw / 1000
              : endRaw;

          if (
            Number.isInteger(surah) &&
            surah >= 1 &&
            surah <= 114 &&
            Number.isInteger(ayah) &&
            ayah >= 1 &&
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            end >= start
          ) {
            allRows.push({
              surah,
              ayah,
              start,
              end,
            });
          }
        }

      }

      if (!allRows.length) {
        throw new Error(
          'هیچ timing ـێکی دروست لە raad_al_kurdi.db نەدۆزرایەوە.',
        );
      }

      allRows.sort(
        (a, b) =>
          (a.surah ?? 0) - (b.surah ?? 0) ||
          a.ayah - b.ayah,
      );

      try {
        sessionStorage.setItem(
          RAAD_TIMING_CACHE_KEY,
          'loaded',
        );
      } catch {
        // Ignore session storage errors.
      }

      return allRows;
    } finally {
      db.close();
    }
  })();

  try {
    return await raadTimingRowsPromise;
  } catch (error) {
    raadTimingRowsPromise = null;
    throw error;
  }
};

async function fetchGaplessTimingFromDb(
  reciterId: string,
  surahNumber: number,
): Promise<TimingRow[]> {
  const config = ALL_RECITERS_DIRECTORY.find(
    (item) => item.id === reciterId,
  );

  if (!config?.timingDbUrl) {
    throw new Error(
      `timingDbUrl ـی ${reciterId} نییە.`,
    );
  }

  const localUrl =
    `${import.meta.env.BASE_URL}gapless-timing/${reciterId}.db`;

  const candidates = [
    localUrl,
    config.timingDbUrl,
  ];

  let buffer: ArrayBuffer | null = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        cache: 'force-cache',
      });

      if (response.ok) {
        buffer = await response.arrayBuffer();
        break;
      }
    } catch {
      // Try the next timing DB source.
    }
  }

  if (!buffer) {
    throw new Error(
      `Gapless timing DB نەکرا بار بکرێت بۆ ${reciterId}.`,
    );
  }

  const SQL = await initSqlJs({
    locateFile: () => SQL_WASM_URL,
  });

  const db = new SQL.Database(
    new Uint8Array(buffer),
  );

  try {
    const quoteIdentifier = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;

    const normalizeColumnName = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, '');

    const tableResult = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    const tableNames =
      tableResult[0]?.values
        .map((row) => String(row[0] ?? ''))
        .filter(Boolean) ?? [];

    let timingTable: string | null = null;
    let surahColumn: string | null = null;
    let ayahColumn: string | null = null;
    let startColumn: string | null = null;
    let endColumn: string | null = null;

    const findColumn = (
      columns: string[],
      candidates: string[],
    ) => {
      const wanted = new Set(
        candidates.map(normalizeColumnName),
      );
      return (
        columns.find((column) =>
          wanted.has(normalizeColumnName(column)),
        ) ?? null
      );
    };

    for (const tableName of tableNames) {
      let infoResult: any[];
      try {
        infoResult = db.exec(
          `PRAGMA table_info(${quoteIdentifier(tableName)})`,
        );
      } catch {
        continue;
      }

      const columns =
        infoResult[0]?.values
          .map((row) => String(row[1] ?? ''))
          .filter(Boolean) ?? [];

      const foundSurah = findColumn(columns, [
        'sura',
        'surah',
        'suranumber',
        'surahnumber',
        'surah_number',
        'chapter',
        'chapternumber',
      ]);
      const foundAyah = findColumn(columns, [
        'ayah',
        'ayahnumber',
        'verse',
        'versenumber',
        'ayah_number',
      ]);
      const foundStart = findColumn(columns, [
        'time',
        'timems',
        'timestamp',
        'start',
        'starttime',
        'starttimems',
        'start_time',
        'from',
        'begin',
      ]);
      const foundEnd = findColumn(columns, [
        'end',
        'endtime',
        'endtimems',
        'end_time',
        'finish',
        'finishtime',
      ]);

      if (foundAyah && foundStart) {
        // Some gapless databases store one table per surah and therefore
        // do not repeat a surah column in every row. Infer the surah from
        // the table name when possible.
        const tableNumberMatch = tableName.match(/(?:^|[^0-9])(\d{1,3})(?:[^0-9]|$)/);
        const tableNumber = tableNumberMatch
          ? Number(tableNumberMatch[1])
          : null;

        if (foundSurah || tableNumber === surahNumber) {
          timingTable = tableName;
          surahColumn = foundSurah;
          ayahColumn = foundAyah;
          startColumn = foundStart;
          endColumn = foundEnd;
          break;
        }
      }
    }

    if (
      !timingTable ||
      !ayahColumn ||
      !startColumn
    ) {
      throw new Error(
        `Timing table/columns نەدۆزرایەوە بۆ ${reciterId}.`,
      );
    }

    const selectedColumns = [
      quoteIdentifier(ayahColumn),
      quoteIdentifier(startColumn),
      ...(endColumn
        ? [quoteIdentifier(endColumn)]
        : []),
    ].join(', ');

    const whereClause = surahColumn
      ? `WHERE ${quoteIdentifier(surahColumn)} = ${Number(surahNumber)}`
      : '';

    const result = db.exec(
      `SELECT ${selectedColumns}
       FROM ${quoteIdentifier(timingTable)}
       ${whereClause}
       ORDER BY ${quoteIdentifier(ayahColumn)} ASC`,
    );

    const rawRows = result[0]?.values ?? [];
    const points = rawRows
      .map((row) => ({
        ayah: Number(row[0]),
        startRaw: Number(row[1]),
        endRaw: endColumn
          ? Number(row[2])
          : NaN,
      }))
      .filter(
        (row) =>
          Number.isInteger(row.ayah) &&
          row.ayah >= 1 &&
          Number.isFinite(row.startRaw),
      );

    const toSeconds = (value: number) => {
      if (!Number.isFinite(value)) return 0;
      return value > 1000 ? value / 1000 : value;
    };

    const timings: TimingRow[] = [];

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const start = toSeconds(point.startRaw);

      const explicitEnd = Number.isFinite(point.endRaw)
        ? toSeconds(point.endRaw)
        : null;

      const nextStart =
        i + 1 < points.length
          ? toSeconds(points[i + 1].startRaw)
          : null;

      const end =
        explicitEnd !== null && explicitEnd >= start
          ? explicitEnd
          : nextStart !== null && nextStart > start
            ? nextStart
            : start + 0.5;

      timings.push({
        surah: surahNumber,
        ayah: point.ayah,
        start,
        end,
      });
    }

    return timings;
  } finally {
    db.close();
  }
}

async function fetchRizgarTimingFromDb(
  surahNumber: number,
): Promise<TimingRow[]> {
  const config = ALL_RECITERS_DIRECTORY.find(
    (item) => item.id === RIZGAR_RECITER_ID,
  );

  if (!config?.timingDbUrl) {
    throw new Error('timingDbUrl ـی ڕزگار کوردی نییە.');
  }

  const localUrl =
    `${import.meta.env.BASE_URL}gapless-timing/${RIZGAR_RECITER_ID}.db`;

  let buffer: ArrayBuffer | null = null;

  for (const url of [localUrl, config.timingDbUrl]) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });

      if (response.ok) {
        buffer = await response.arrayBuffer();
        break;
      }
    } catch {
      // Try the next source.
    }
  }

  if (!buffer) {
    throw new Error('DB ـی timing ـی ڕزگار نەکرا بار بکرێت.');
  }

  const SQL = await initSqlJs({
    locateFile: () => SQL_WASM_URL,
  });

  const db = new SQL.Database(new Uint8Array(buffer));

  try {
    // The real Rizgar DB schema is:
    // timings(sura INTEGER, ayah INTEGER, time INTEGER)
    // and ayah=999 is the end-of-surah marker.
    const tableInfo = db.exec(
      'PRAGMA table_info("timings")',
    );

    const columns =
      tableInfo[0]?.values
        .map((row) => String(row[1] ?? '').toLowerCase())
        .filter(Boolean) ?? [];

    if (
      !columns.includes('sura') ||
      !columns.includes('ayah') ||
      !columns.includes('time')
    ) {
      throw new Error(
        'Schema ـی DB ـی ڕزگار چاوەڕوانکراو نییە.',
      );
    }

    const result = db.exec(
      `SELECT "sura", "ayah", "time"
       FROM "timings"
       WHERE "sura" = ${Number(surahNumber)}
       ORDER BY "ayah" ASC`,
    );

    const rawRows = result[0]?.values ?? [];

    const toSeconds = (value: number) => {
      if (!Number.isFinite(value) || value < 0) return 0;
      return value > 1000 ? value / 1000 : value;
    };

    const points = rawRows
      .map((row) => ({
        surah: Number(row[0]),
        ayah: Number(row[1]),
        time: Number(row[2]),
      }))
      .filter(
        (row) =>
          row.surah === surahNumber &&
          Number.isInteger(row.ayah) &&
          row.ayah >= 1 &&
          Number.isFinite(row.time) &&
          row.time >= 0,
      );

    if (!points.length) {
      throw new Error(
        `هیچ timing ـێکی ڕزگار بۆ سورەتی ${surahNumber} نەدۆزرایەوە.`,
      );
    }

    const endMarker =
      points.find((point) => point.ayah === 999) ?? null;

    const ayahPoints = points
      .filter((point) => point.ayah >= 1 && point.ayah < 999)
      .sort((a, b) => a.ayah - b.ayah);

    if (!ayahPoints.length) {
      throw new Error(
        `هیچ ئایەتێکی timing ـی ڕزگار بۆ سورەتی ${surahNumber} نەدۆزرایەوە.`,
      );
    }

    const rows: TimingRow[] = [];

    for (let i = 0; i < ayahPoints.length; i += 1) {
      const current = ayahPoints[i];
      const next = ayahPoints[i + 1];

      const start = toSeconds(current.time);
      const nextStart = next
        ? toSeconds(next.time)
        : endMarker
          ? toSeconds(endMarker.time)
          : start + 0.5;

      rows.push({
        surah: surahNumber,
        ayah: current.ayah,
        start,
        end:
          nextStart > start
            ? nextStart
            : start + 0.5,
      });
    }

    return rows;
  } finally {
    db.close();
  }
}
async function fetchRaadTiming(
  surahNumber: number,
): Promise<TimingRow[]> {
  const rows = await fetchGaplessTimingFromDb(RAAD_RECITER_ID, surahNumber);

  return rows.filter(
    (row) => row.surah === surahNumber,
  );
}

const getInitialReciter = (
  reciters: DynamicReciter[],
): DynamicReciter | null => {
  try {
    const saved =
      localStorage.getItem(
        'quran_selected_reciter',
      );

    if (saved) {
      const found =
        reciters.find(
          (reciter) =>
            reciter.id === saved,
        );

      if (found) return found;
    }
  } catch {
    // Ignore storage errors.
  }

  return reciters[0] ?? null;
};

export function QuranReader({
  currentPage,
  onNextPage,
  onPrevPage,
  onBackToIndex,
  bgStyle,
  appLang,
  showNumbers,
  surahsList,
  onJumpToPage,
}: QuranReaderProps) {
  const audioRef =
    useRef<HTMLAudioElement | null>(
      null,
    );

  const pagesRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const timingCacheRef =
    useRef(
      new Map<
        string,
        TimingRow[]
      >(),
    );

  const loadingPlayRef =
    useRef(false);

  const activeTimingRef =
    useRef<TimingRow | null>(null);

  const playRequestRef =
    useRef(0);

  const [reciters, setReciters] =
    useState<DynamicReciter[]>(() => {
      return (
        readJsonCache<
          DynamicReciter[]
        >(RECITERS_CACHE_KEY) ?? []
      );
    });

  const [selectedReciter, setSelectedReciter] =
    useState<DynamicReciter | null>(
      () => {
        const cached =
          readJsonCache<DynamicReciter[]>(
            RECITERS_CACHE_KEY,
          ) ?? [];

        const merged = [
          makeRizgarReciter(),
          makeRaadReciter(),
          ...cached.filter(
            (item) =>
              item.id !== RIZGAR_RECITER_ID &&
              item.id !== RAAD_RECITER_ID,
          ),
        ];

        return getInitialReciter(merged);
      },
    );

  const [ayahs, setAyahs] =
    useState<AyahData[]>([]);

  const [ayahBoxes, setAyahBoxes] =
    useState<AyahCoordinate[]>([]);

  const [
    playingAyah,
    setPlayingAyah,
  ] = useState<{
    page: number;
    surahNumber: number;
    ayahNumber: number;
  } | null>(null);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    timingRows,
    setTimingRows,
  ] = useState<TimingRow[]>([]);

  const [
    selectedSurahNumber,
    setSelectedSurahNumber,
  ] = useState<number>(
    getPageSurahNumber(
      currentPage,
      surahsList,
    ),
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const fresh =
          await fetchDynamicKurdishReciters();

        if (cancelled) return;

        setReciters(fresh);

        setSelectedReciter(
          (old) => {
            if (!old) {
              return getInitialReciter(
                fresh,
              );
            }

            return (
              fresh.find(
                (item) =>
                  item.id === old.id,
              ) ??
              getInitialReciter(fresh)
            );
          },
        );
      } catch (err) {
        if (cancelled) return;

        const cached =
          readJsonCache<
            DynamicReciter[]
          >(RECITERS_CACHE_KEY);

        if (
          Array.isArray(cached) &&
          cached.length
        ) {
          setReciters(cached);
          setSelectedReciter(
            (old) =>
              old ??
              getInitialReciter(
                cached,
              ),
          );
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'کێشە لە هێنانی قارییەکان.',
        );
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedSurahNumber(
      getPageSurahNumber(
        currentPage,
        surahsList,
      ),
    );
  }, [
    currentPage,
    surahsList,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadCoordinates = async () => {
      try {
        const boxes = await getAyahBoxesForPage(
          currentPage,
        );

        if (!cancelled) {
          setAyahBoxes(boxes);
        }
      } catch {
        if (!cancelled) {
          setAyahBoxes([]);
        }
      }
    };

    loadCoordinates();

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setError(null);

        const data =
          await fetchPageAyahs(
            currentPage,
          );

        if (cancelled) return;

        setAyahs(data);
      } catch (err) {
        if (cancelled) return;

        setAyahs([]);

        setError(
          err instanceof Error
            ? err.message
            : 'دەقی لاپەڕەکە نەهێنرا.',
        );
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    const audio =
      audioRef.current;

    ++playRequestRef.current;
    activeTimingRef.current = null;
    loadingPlayRef.current = false;

    stopRizgarWebAudio();

    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    setPlayingAyah(null);
    setIsPlaying(false);
    setIsLoading(false);
    setTimingRows([]);
  }, [
    currentPage,
    selectedReciter?.id,
  ]);

  useEffect(() => {
    if (!selectedReciter) return;

    try {
      localStorage.setItem(
        'quran_selected_reciter',
        selectedReciter.id,
      );
    } catch {
      // Ignore storage errors.
    }

    window.dispatchEvent(
      new CustomEvent(
        'quran-reciter-changed',
        {
          detail: {
            reciter:
              selectedReciter.id,
          },
        },
      ),
    );
  }, [selectedReciter]);

  useEffect(() => {
    return () => {
      ++playRequestRef.current;
      activeTimingRef.current = null;
      const audio = audioRef.current;
      stopRizgarWebAudio();

      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }





    };
  }, [stopRizgarWebAudio]);

  const availableForCurrentSurah =
    useMemo(() => {
      if (!selectedReciter) {
        return false;
      }

      return selectedReciter.surahList.includes(
        selectedSurahNumber,
      );
    }, [
      selectedReciter,
      selectedSurahNumber,
    ]);

  const timingForCurrentSurah =
    useCallback(
      async (
        reciter: DynamicReciter,
        surahNumber: number,
      ) => {
        const key =
          `${reciter.moshafId}:${surahNumber}`;

        const local =
          timingCacheRef.current.get(
            key,
          );

        if (local) {
          return local;
        }

        const rows =
          reciter.id === RAAD_RECITER_ID
            ? await fetchRaadTiming(surahNumber)
            : reciter.id === RIZGAR_RECITER_ID
              ? await fetchRizgarTiming(surahNumber)
              : await fetchMp3QuranTiming(
                  reciter.moshafId,
                  surahNumber,
                );

        timingCacheRef.current.set(
          key,
          rows,
        );

        return rows;
      },
      [],
    );

  const getCurrentPageAyahIndex =
    useCallback(
      (
        audioTime: number,
        rows: TimingRow[],
        pageAyahs: AyahData[],
        activeSurahNumber: number,
      ) => {
        if (!rows.length || !pageAyahs.length) return -1;

        const rowByAyah = new Map(
          rows
            .filter((row) => row.surah === undefined || row.surah === activeSurahNumber)
            .map((row) => [row.ayah, row]),
        );

        for (let i = 0; i < pageAyahs.length; i += 1) {
          const ayah = pageAyahs[i];
          const surahNumber = Number(
            ayah?.surahNumber ??
              (ayah as any)?.surah?.number ??
              0,
          );
          if (surahNumber !== activeSurahNumber) continue;

          const ayahNumber = Number(
            ayah?.ayah ??
              ayah?.numberInSurah ??
              i + 1,
          );
          const timing = rowByAyah.get(ayahNumber);
          if (!timing) continue;

          if (
            audioTime >= timing.start &&
            audioTime <= Math.max(timing.end, timing.start + 0.15)
          ) {
            return i;
          }
        }

        return -1;
      },
      [],
    );

  const waitForMetadata =
    useCallback(
      (audio: HTMLAudioElement) =>
        new Promise<void>((resolve, reject) => {
          if (
            Number.isFinite(audio.duration) &&
            audio.readyState >= 1
          ) {
            resolve();
            return;
          }

          let finished = false;

          const cleanup = () => {
            audio.removeEventListener(
              'loadedmetadata',
              done,
            );
            audio.removeEventListener(
              'error',
              failed,
            );
            window.clearTimeout(timer);
          };

          const done = () => {
            if (finished) return;
            finished = true;
            cleanup();
            resolve();
          };

          const failed = () => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(
              new Error(
                'فایلی دەنگییەکە نەکرا بار بکرێت.',
              ),
            );
          };

          const timer = window.setTimeout(() => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(
              new Error(
                'بارکردنی فایلی دەنگی زۆر درێژ بوو.',
              ),
            );
          }, 10000);

          audio.addEventListener(
            'loadedmetadata',
            done,
            { once: true },
          );
          audio.addEventListener(
            'error',
            failed,
            { once: true },
          );
        }),
      [],
    );

  const announceAudioPlaying =
    useCallback((audio: HTMLAudioElement) => {
      window.dispatchEvent(
        new CustomEvent<HTMLAudioElement>(
          'quran-audio-playing',
          { detail: audio },
        ),
      );
    }, []);

  const playAyah =
    useCallback(
      async (
        indexOrIdentity:
          | number
          | {
              surahNumber: number;
              ayahNumber: number;
            },
      ) => {
        const identity =
          typeof indexOrIdentity === 'number'
            ? null
            : indexOrIdentity;

        const index =
          typeof indexOrIdentity === 'number'
            ? indexOrIdentity
            : ayahs.findIndex(
                (ayah) =>
                  Number(
                    ayah?.surahNumber ??
                      (ayah as any)?.surah?.number ??
                      0,
                  ) === identity.surahNumber &&
                  Number(
                    ayah?.ayah ??
                      ayah?.numberInSurah ??
                      0,
                  ) === identity.ayahNumber,
              );

        const selectedAyah = ayahs[index];

        if (
          !selectedReciter ||
          !selectedAyah ||
          index < 0
        ) {
          return;
        }

        const surahNumber = Number(
          selectedAyah?.surahNumber ??
            (selectedAyah as any)?.surah?.number ??
            selectedSurahNumber,
        );

        if (
          !selectedReciter.surahList.includes(
            surahNumber,
          )
        ) {
          setError(
            `ئەم سۆرەتە لەلایەن ${selectedReciter.name} بەردەست نییە.`,
          );
          return;
        }

        const audio = audioRef.current;
        if (!audio) return;

        const ayahNumber =
          identity?.ayahNumber ??
          Number(
            selectedAyah?.ayah ??
              selectedAyah?.numberInSurah ??
              index + 1,
          );

        const requestId =
          ++playRequestRef.current;

        loadingPlayRef.current = true;
        setIsLoading(true);
        setError(null);
        activeTimingRef.current = null;
        setPlayingAyah(null);
        setIsPlaying(false);
        audio.pause();

        try {
          const rows =
            await timingForCurrentSurah(
              selectedReciter,
              surahNumber,
            );

          if (
            requestId !==
            playRequestRef.current
          ) return;

          setTimingRows(rows);

          const timing = rows.find(
            (row) =>
              (row.surah === undefined ||
                row.surah === surahNumber) &&
              row.ayah === ayahNumber,
          );

          const src = makeSurahAudioUrl(
            selectedReciter,
            surahNumber,
          );

          audio.pause();
          audio.removeAttribute('src');
          audio.load();
          audio.src = src;
          audio.load();

          await waitForMetadata(audio);

          if (
            requestId !==
            playRequestRef.current
          ) return;

          if (timing) {
            const target = Math.max(
              0,
              Math.min(
                timing.start,
                Number.isFinite(audio.duration)
                  ? Math.max(
                      0,
                      audio.duration - 0.05,
                    )
                  : timing.start,
              ),
            );

            const applySeek = () => {
              try {
                audio.currentTime = target;
              } catch {
                // Ignore transient seek errors.
              }
            };

            applySeek();

            await new Promise<void>(
              (resolve) => {
                if (
                  Math.abs(
                    audio.currentTime - target,
                  ) <= 0.15
                ) {
                  resolve();
                  return;
                }

                let settled = false;

                const finish = () => {
                  if (settled) return;
                  settled = true;
                  audio.removeEventListener(
                    'seeked',
                    finish,
                  );
                  window.clearTimeout(timer);
                  resolve();
                };

                const timer =
                  window.setTimeout(
                    finish,
                    1500,
                  );

                audio.addEventListener(
                  'seeked',
                  finish,
                  { once: true },
                );

                applySeek();
              },
            );

            applySeek();
            activeTimingRef.current =
              timing;

            setPlayingAyah({
              page: currentPage,
              surahNumber,
              ayahNumber,
            });
          } else {
            activeTimingRef.current = null;
            setPlayingAyah(null);
          }

          await audio.play();

          if (
            requestId !==
            playRequestRef.current
          ) {
            audio.pause();
            return;
          }

          announceAudioPlaying(audio);
          setIsPlaying(true);
        } catch (err) {
          if (
            requestId !==
            playRequestRef.current
          ) return;

          activeTimingRef.current = null;
          setPlayingAyah(null);
          setIsPlaying(false);
          setError(
            err instanceof Error
              ? err.message
              : 'دەنگەکە نەکرا پخش بکرێت.',
          );
        } finally {
          if (
            requestId ===
            playRequestRef.current
          ) {
            loadingPlayRef.current = false;
            setIsLoading(false);
          }
        }
      },
      [
        ayahs,
        selectedReciter,
        selectedSurahNumber,
        timingForCurrentSurah,
        waitForMetadata,
        announceAudioPlaying,
        currentPage,
      ],
    );

  const stopAudio =
    useCallback(() => {
      ++playRequestRef.current;
      loadingPlayRef.current = false;
      activeTimingRef.current = null;

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Ignore.
        }
      }

      setIsLoading(false);
      setIsPlaying(false);
      setPlayingAyah(null);
    }, []);

  const togglePlayPause =
    useCallback(() => {
      const audio = audioRef.current;
      if (!audio || playingAyah === null) {
        return;
      }

      if (audio.paused) {
        announceAudioPlaying(audio);
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() =>
            setError(
              'دەنگەکە نەکرا پخش بکرێت.',
            ),
          );
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    }, [
      announceAudioPlaying,
      playingAyah,
    ]);

  const handleTimeUpdate =
    useCallback(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const now = audio.currentTime;
      const activeTiming =
        activeTimingRef.current;

      if (!activeTiming) return;

      const end = Math.max(
        activeTiming.end,
        activeTiming.start + 0.05,
      );

      if (now >= end - 0.02) {
        audio.pause();
        setIsPlaying(false);

        const current = playingAyah;
        if (
          !current ||
          current.page !== currentPage
        ) {
          activeTimingRef.current = null;
          return;
        }

        const currentIndex =
          ayahs.findIndex(
            (item) =>
              Number(
                item?.surahNumber ??
                  (item as any)?.surah?.number ??
                  0,
              ) === current.surahNumber &&
              Number(
                item?.ayah ??
                  item?.numberInSurah ??
                  0,
              ) === current.ayahNumber,
          );

        const nextIndex =
          ayahs.findIndex(
            (ayah, index) =>
              index > currentIndex &&
              Number(
                ayah?.surahNumber ??
                  (ayah as any)?.surah?.number ??
                  0,
              ) === current.surahNumber,
          );

        if (
          nextIndex >= 0 &&
          nextIndex < ayahs.length
        ) {
          const nextAyah =
            ayahs[nextIndex];

          const nextAyahNumber =
            Number(
              nextAyah?.ayah ??
                nextAyah?.numberInSurah ??
                nextIndex + 1,
            );

          const nextTiming =
            timingRows.find(
              (row) =>
                (row.surah === undefined ||
                  row.surah ===
                    current.surahNumber) &&
                row.ayah === nextAyahNumber,
            );

          if (nextTiming) {
            activeTimingRef.current =
              nextTiming;

            setPlayingAyah({
              page: currentPage,
              surahNumber:
                current.surahNumber,
              ayahNumber:
                nextAyahNumber,
            });

            try {
              audio.currentTime =
                Math.max(
                  0,
                  nextTiming.start,
                );
            } catch {
              // Ignore.
            }

            announceAudioPlaying(audio);
            audio
              .play()
              .then(() =>
                setIsPlaying(true),
              )
              .catch(() =>
                setError(
                  'دەنگەکە نەکرا بەردەوام بکرێت.',
                ),
              );
            return;
          }
        }

        activeTimingRef.current = null;
        setPlayingAyah(null);
        return;
      }

      if (
        playingAyah === null ||
        !ayahs.length ||
        !timingRows.length
      ) return;

      const activeSurahNumber =
        playingAyah.surahNumber ??
        selectedSurahNumber;

      const index =
        getCurrentPageAyahIndex(
          now,
          timingRows,
          ayahs,
          activeSurahNumber,
        );

      if (index >= 0) {
        const currentAyah =
          ayahs[index];

        const currentSurahNumber =
          Number(
            currentAyah?.surahNumber ??
              (currentAyah as any)?.surah?.number ??
              activeSurahNumber,
          );

        const currentAyahNumber =
          Number(
            currentAyah?.ayah ??
              currentAyah?.numberInSurah ??
              index + 1,
          );

        if (
          playingAyah.page !== currentPage ||
          playingAyah.surahNumber !==
            currentSurahNumber ||
          playingAyah.ayahNumber !==
            currentAyahNumber
        ) {
          setPlayingAyah({
            page: currentPage,
            surahNumber:
              currentSurahNumber,
            ayahNumber:
              currentAyahNumber,
          });
        }
      }
    }, [
      announceAudioPlaying,
      ayahs,
      currentPage,
      getCurrentPageAyahIndex,
      playingAyah,
      selectedSurahNumber,
      timingRows,
    ]);

  const handleEnded =
    useCallback(() => {
      activeTimingRef.current = null;
      loadingPlayRef.current = false;
      setPlayingAyah(null);
      setIsPlaying(false);
      setIsLoading(false);
    }, []);

  const handleEnded =
    useCallback(() => {
      activeTimingRef.current = null;
      loadingPlayRef.current = false;
      setPlayingAyah(null);

      setIsPlaying(false);
      setIsLoading(false);
    }, []);

  const renderAyahAreas =
    useCallback(() => {
      if (!ayahs.length || !ayahBoxes.length) {
        return null;
      }

      const ayahByKey = new Map(
        ayahs.map((ayah, index) => [
          `${Number(
            ayah?.surahNumber ??
              (ayah as any)?.surah?.number ??
              selectedSurahNumber,
          )}:${Number(
            ayah?.ayah ??
              ayah?.numberInSurah ??
              index + 1,
          )}`,
          { ayah, index },
        ]),
      );

      return ayahBoxes
        .map((box) => {
          const match = ayahByKey.get(
            `${box.surahNumber}:${box.ayahNumber}`,
          );
          if (!match) return null;

          const audioActive =
            playingAyah?.page === currentPage &&
            playingAyah.surahNumber ===
              box.surahNumber &&
            playingAyah.ayahNumber ===
              box.ayahNumber;

          return (
            <button
              key={`ayah-${currentPage}-${box.surahNumber}-${box.ayahNumber}`}
              type="button"
              aria-label={`ئایەت ${box.surahNumber}:${box.ayahNumber}`}
              onPointerDown={
                selectedReciter?.id === RIZGAR_RECITER_ID
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void playAyah({
                        surahNumber:
                          box.surahNumber,
                        ayahNumber:
                          box.ayahNumber,
                      });
                    }
                  : undefined
              }
              onClick={
                selectedReciter?.id === RIZGAR_RECITER_ID
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      void playAyah({
                        surahNumber:
                          box.surahNumber,
                        ayahNumber:
                          box.ayahNumber,
                      });
                    }
              }
              style={{
                position: 'absolute',
                left: `${box.left}%`,
                top: `${box.top}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
                padding: 0,
                margin: 0,
                border:
                  audioActive
                    ? selectedReciter?.id ===
                      RIZGAR_RECITER_ID
                      ? '2px solid rgba(0,150,80,0.95)'
                      : '2px solid rgba(255,174,0,0.9)'
                    : '1px solid transparent',
                borderRadius: 6,
                background:
                  audioActive
                    ? selectedReciter?.id ===
                      RIZGAR_RECITER_ID
                      ? 'rgba(0,150,80,0.26)'
                      : 'rgba(255,196,0,0.26)'
                    : 'transparent',
                boxShadow:
                  audioActive
                    ? selectedReciter?.id ===
                      RIZGAR_RECITER_ID
                      ? '0 0 14px rgba(0,150,80,0.22)'
                      : '0 0 14px rgba(255,174,0,0.22)'
                    : 'none',
                cursor: 'pointer',
                zIndex: 20,
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                }}
              />
            </button>
          );
        })
        .filter(Boolean);
    }, [
      ayahBoxes,
      ayahs,
      currentPage,
      playAyah,
      playingAyah,
      selectedReciter,
      selectedSurahNumber,
    ]);

  const handleReciterChange =
    useCallback(
      (
        event: React.ChangeEvent<HTMLSelectElement>,
      ) => {
        const id =
          event.target.value;

        const found =
          reciters.find(
            (item) =>
              item.id === id,
          ) ?? null;

        setSelectedReciter(
          found,
        );
      },
      [reciters],
    );

  const handlePageClick =
    useCallback(
      (
        page: number,
      ) => {
        if (page === currentPage) {
          return;
        }

        if (onJumpToPage) {
          onJumpToPage(page);
        } else if (
          page > currentPage
        ) {
          onNextPage();
        } else {
          onPrevPage();
        }
      },
      [
        currentPage,
        onJumpToPage,
        onNextPage,
        onPrevPage,
      ],
    );

  const pages = useMemo(
    () =>
      Array.from(
        {
          length: PAGE_COUNT,
        },
        (_, index) =>
          PAGE_COUNT - index,
      ),
    [],
  );

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background:
          bgStyle?.background ??
          '#fff',
        color: '#111',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        ...bgStyle,
      }}
    >
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={
          handleTimeUpdate
        }
        onEnded={handleEnded}
        onPlay={() =>
          setIsPlaying(true)
        }
        onPause={() =>
          setIsPlaying(false)
        }
        onError={() =>
          setError(
            'فایلە دەنگییەکە نەدۆزرایەوە یان سێرڤەر ڕێگەی پخشکردنی نەدا.',
          )
        }
      />

      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 16,
          background:
            'rgba(255,255,255,0.92)',
          boxShadow:
            '0 4px 18px rgba(0,0,0,0.10)',
          backdropFilter:
            'blur(12px)',
        }}
      >
        <button
          type="button"
          onClick={onBackToIndex}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '9px 11px',
            background: '#222',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          فهرست
        </button>

        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          لاپەڕە {currentPage}
        </div>

        <select
          value={
            selectedReciter?.id ??
            ''
          }
          onChange={
            handleReciterChange
          }
          disabled={!reciters.length}
          style={{
            maxWidth: 190,
            minWidth: 110,
            border: '1px solid #ddd',
            borderRadius: 10,
            padding: '8px 9px',
            background: '#fff',
            color: '#222',
            outline: 'none',
            fontSize: 12,
          }}
        >
          {!reciters.length && (
            <option value="">
              قارییەکان...
            </option>
          )}

          {reciters.map(
            (reciter) => (
              <option
                key={reciter.id}
                value={reciter.id}
              >
                {reciter.name} —{' '}
                {reciter.surahTotal}/114
              </option>
            ),
          )}
        </select>
      </div>

      {(error ||
        !availableForCurrentSurah) &&
        selectedReciter && (
          <div
            style={{
              position: 'absolute',
              top: 72,
              left: 12,
              right: 12,
              zIndex: 95,
              padding:
                '9px 12px',
              borderRadius: 12,
              background: error
                ? 'rgba(180,30,30,0.94)'
                : 'rgba(30,30,30,0.88)',
              color: '#fff',
              textAlign: 'center',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error ??
              `سۆرەتی ${selectedSurahNumber} لەلایەن ${selectedReciter.name} بەردەست نییە.`}
          </div>
        )}

      <div
        ref={pagesRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          gap: 12,
          padding:
            '90px 8px 110px',
          scrollSnapType:
            'x mandatory',
          WebkitOverflowScrolling:
            'touch',
        }}
      >
        {pages.map(
          (page) => {
            const active =
              page === currentPage;

            return (
              <div
                key={page}
                onClick={() =>
                  handlePageClick(
                    page,
                  )
                }
                style={{
                  position: 'relative',
                  flex:
                    '0 0 min(92vw, 520px)',
                  height:
                    'calc(100vh - 200px)',
                  scrollSnapAlign:
                    'center',
                  borderRadius: 8,
                  background:
                    '#fff',
                  overflow: 'hidden',
                  opacity: active
                    ? 1
                    : 0.45,
                  transform: active
                    ? 'scale(1)'
                    : 'scale(0.97)',
                  transition:
                    'opacity .2s ease, transform .2s ease',
                  boxShadow:
                    active
                      ? '0 8px 28px rgba(0,0,0,0.14)'
                      : '0 2px 10px rgba(0,0,0,0.05)',
                  cursor:
                    active
                      ? 'default'
                      : 'pointer',
                }}
              >
                <img
                  src={pageImgUrl(
                    page,
                  )}
                  alt={`Quran page ${page}`}
                  draggable={false}
                  style={{
                    position:
                      'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'contain',
                    userSelect:
                      'none',
                    WebkitUserDrag:
                      'none',
                    pointerEvents:
                      'none',
                    filter:
                      'grayscale(100%) contrast(115%) brightness(102%)',
                    mixBlendMode:
                      'multiply',
                  }}
                />

                {active &&
                  renderAyahAreas()}

                {active &&
                  isLoading && (
                    <div
                      style={{
                        position:
                          'absolute',
                        top: '50%',
                        left: '50%',
                        transform:
                          'translate(-50%, -50%)',
                        zIndex: 60,
                        padding:
                          '9px 13px',
                        borderRadius: 12,
                        background:
                          'rgba(0,0,0,0.72)',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    >
                      دەنگ بار دەکرێت...
                    </div>
                  )}

                {active &&
                  showNumbers && (
                    <div
                      style={{
                        position:
                          'absolute',
                        bottom: 8,
                        left: '50%',
                        transform:
                          'translateX(-50%)',
                        zIndex: 80,
                        minWidth: 38,
                        textAlign:
                          'center',
                        padding:
                          '5px 9px',
                        borderRadius: 999,
                        background:
                          'rgba(255,255,255,0.9)',
                        boxShadow:
                          '0 2px 8px rgba(0,0,0,0.12)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {page}
                    </div>
                  )}
              </div>
            );
          },
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          zIndex: 110,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 10px',
          borderRadius: 16,
          background:
            'rgba(255,255,255,0.95)',
          boxShadow:
            '0 -3px 18px rgba(0,0,0,0.12)',
          backdropFilter:
            'blur(12px)',
        }}
      >
        <button
          type="button"
          onClick={
            togglePlayPause
          }
          disabled={
            playingAyah ===
              null ||
            isLoading
          }
          style={{
            width: 42,
            height: 42,
            border: 'none',
            borderRadius: 12,
            background:
              '#222',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 17,
            flexShrink: 0,
            opacity:
              playingAyah ===
                null ||
              isLoading
                ? 0.5
                : 1,
          }}
        >
          {isPlaying
            ? 'Ⅱ'
            : '▶'}
        </button>

        <button
          type="button"
          onClick={stopAudio}
          style={{
            width: 42,
            height: 42,
            border: '1px solid #ddd',
            borderRadius: 12,
            background: '#fff',
            color: '#222',
            cursor: 'pointer',
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          ■
        </button>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'right',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              whiteSpace:
                'nowrap',
              overflow:
                'hidden',
              textOverflow:
                'ellipsis',
            }}
          >
            {selectedReciter?.name ??
              'قاری'}
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 11,
              color: '#777',
            }}
          >
            {playingAyah !== null
              ? `ئایەت ${playingAyah.surahNumber}:${playingAyah.ayahNumber}`
              : 'ئایەتێک هەڵبژێرە'}
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onPrevPage()
          }
          disabled={
            currentPage <= 1
          }
          style={{
            border: '1px solid #ddd',
            borderRadius: 10,
            padding:
              '8px 10px',
            background: '#fff',
            cursor: 'pointer',
            opacity:
              currentPage <= 1
                ? 0.4
                : 1,
          }}
        >
          →
        </button>

        <button
          type="button"
          onClick={() =>
            onNextPage()
          }
          disabled={
            currentPage >=
            PAGE_COUNT
          }
          style={{
            border: '1px solid #ddd',
            borderRadius: 10,
            padding:
              '8px 10px',
            background: '#fff',
            cursor: 'pointer',
            opacity:
              currentPage >=
              PAGE_COUNT
                ? 0.4
                : 1,
          }}
        >
          ←
        </button>
      </div>
    </div>
  );
}

export default QuranReader;
