/* =========================================================
   QURAN AYAH COORDINATES
   =========================================================

   Source:
   quranpedia/quran-svg
   Mushaf:
   Hafs / King Fahd Complex

   The source contains 604 pages with a polygon for
   every ayah.

   We convert the source coordinates to percentage
   coordinates so they continue to work when the
   Mushaf image is resized on different phones.

   Source coordinate space:
   345 × 550

   Our result:
   x/y/width/height as percentages.
   ========================================================= */

const SOURCE_BASE =
  'https://raw.githubusercontent.com/quranpedia/quran-svg/main/mushafs/hafs/kfqc/json/';

const SOURCE_WIDTH = 345;
const SOURCE_HEIGHT = 550;

export interface AyahCoordinate {
  surahNumber: number;
  ayahNumber: number;

  /*
   * Original polygon points in source coordinates.
   */
  polygon: Array<{
    x: number;
    y: number;
  }>;

  /*
   * Bounding box in source coordinates.
   */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;

  /*
   * Bounding box as percentages.
   * These are useful for absolute-positioned
   * HTML click areas.
   */
  left: number;
  top: number;
  width: number;
  height: number;

  /*
   * Ayah marker center.
   */
  centerX: number;
  centerY: number;
}

/* =========================================================
   CACHE
   ========================================================= */

const CACHE_PREFIX =
  'quran_ayah_coordinates_v1:';

const memoryCache =
  new Map<
    number,
    AyahCoordinate[]
  >();

/* =========================================================
   SAFE LOCAL STORAGE
   ========================================================= */

const readLocalCache = (
  page: number,
): AyahCoordinate[] | null => {
  try {
    const raw =
      localStorage.getItem(
        `${CACHE_PREFIX}${page}`,
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as AyahCoordinate[];
  } catch {
    return null;
  }
};

const writeLocalCache = (
  page: number,
  value: AyahCoordinate[],
) => {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${page}`,
      JSON.stringify(value),
    );
  } catch {
    /*
     * Storage can be unavailable or full.
     * Coordinates still work through memory cache.
     */
  }
};

/* =========================================================
   PARSE POLYGON
   ========================================================= */

const parsePolygon = (
  value: unknown,
) => {
  if (
    typeof value !==
    'string'
  ) {
    return [];
  }

  const points =
    value
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [
          xRaw,
          yRaw,
        ] = pair.split(',');

        const x =
          Number(xRaw);

        const y =
          Number(yRaw);

        if (
          !Number.isFinite(
            x,
          ) ||
          !Number.isFinite(
            y,
          )
        ) {
          return null;
        }

        return {
          x,
          y,
        };
      })
      .filter(
        (
          point,
        ): point is {
          x: number;
          y: number;
        } =>
          point !== null,
      );

  return points;
};

/* =========================================================
   CONVERT SOURCE JSON
   ========================================================= */

const convertRow = (
  row: any,
): AyahCoordinate | null => {
  const surahNumber =
    Number(
      row?.surahNumber,
    );

  const ayahNumber =
    Number(
      row?.ayahNumber,
    );

  if (
    !Number.isInteger(
      surahNumber,
    ) ||
    surahNumber < 1 ||
    surahNumber > 114
  ) {
    return null;
  }

  if (
    !Number.isInteger(
      ayahNumber,
    ) ||
    ayahNumber < 1
  ) {
    return null;
  }

  const polygon =
    parsePolygon(
      row?.polygon,
    );

  if (
    polygon.length < 3
  ) {
    return null;
  }

  let minX =
    Number.POSITIVE_INFINITY;

  let minY =
    Number.POSITIVE_INFINITY;

  let maxX =
    Number.NEGATIVE_INFINITY;

  let maxY =
    Number.NEGATIVE_INFINITY;

  for (const point of polygon) {
    minX = Math.min(
      minX,
      point.x,
    );

    minY = Math.min(
      minY,
      point.y,
    );

    maxX = Math.max(
      maxX,
      point.x,
    );

    maxY = Math.max(
      maxY,
      point.y,
    );
  }

  const width =
    Math.max(
      0,
      maxX - minX,
    );

  const height =
    Math.max(
      0,
      maxY - minY,
    );

  const left =
    (minX /
      SOURCE_WIDTH) *
    100;

  const top =
    (minY /
      SOURCE_HEIGHT) *
    100;

  const widthPercent =
    (width /
      SOURCE_WIDTH) *
    100;

  const heightPercent =
    (height /
      SOURCE_HEIGHT) *
    100;

  const centerX =
    Number.isFinite(
      Number(row?.x),
    )
      ? Number(row.x)
      : (minX + maxX) / 2;

  const centerY =
    Number.isFinite(
      Number(row?.y),
    )
      ? Number(row.y)
      : (minY + maxY) / 2;

  return {
    surahNumber,
    ayahNumber,

    polygon,

    minX,
    minY,
    maxX,
    maxY,

    left,
    top,
    width:
      widthPercent,
    height:
      heightPercent,

    centerX,
    centerY,
  };
};

/* =========================================================
   FETCH ONE PAGE
   ========================================================= */

export const getAyahCoordinatesForPage =
  async (
    page: number,
  ): Promise<
    AyahCoordinate[]
  > => {
    const safePage =
      Math.max(
        1,
        Math.min(
          604,
          Math.round(page),
        ),
      );

    /*
     * Memory cache first.
     */
    const memory =
      memoryCache.get(
        safePage,
      );

    if (memory) {
      return memory;
    }

    /*
     * LocalStorage cache second.
     */
    const local =
      readLocalCache(
        safePage,
      );

    if (local?.length) {
      memoryCache.set(
        safePage,
        local,
      );

      return local;
    }

    /*
     * Download only the current page.
     *
     * We DO NOT download all 604 JSON files.
     */
    const filename =
      String(
        safePage,
      ).padStart(
        3,
        '0',
      );

    const url =
      `${SOURCE_BASE}${filename}.json`;

    const response =
      await fetch(
        url,
        {
          cache:
            'force-cache',
        },
      );

    if (!response.ok) {
      throw new Error(
        `Ayah coordinates ${safePage}: ${response.status}`,
      );
    }

    const json =
      await response.json();

    if (
      !Array.isArray(json)
    ) {
      throw new Error(
        `Ayah coordinates ${safePage}: invalid data`,
      );
    }

    const result =
      json
        .map(
          (
            row: any,
          ) =>
            convertRow(
              row,
            ),
        )
        .filter(
          (
            row,
          ): row is AyahCoordinate =>
            row !== null,
        );

    memoryCache.set(
      safePage,
      result,
    );

    writeLocalCache(
      safePage,
      result,
    );

    return result;
  };

/* =========================================================
   ALIAS
   =========================================================

   This is the name we will use inside the Quran reader.
   ========================================================= */

export const getAyahBoxesForPage =
  getAyahCoordinatesForPage;

/* =========================================================
   FIND ONE AYAH
   ========================================================= */

export const getAyahCoordinate =
  async (
    page: number,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<
    AyahCoordinate | null
  > => {
    const coordinates =
      await getAyahCoordinatesForPage(
        page,
      );

    return (
      coordinates.find(
        (item) =>
          item.surahNumber ===
            surahNumber &&
          item.ayahNumber ===
            ayahNumber,
      ) ?? null
    );
  };

/* =========================================================
   CLEAR CACHE
   ========================================================= */

export const clearAyahCoordinatesCache =
  () => {
    memoryCache.clear();

    try {
      const keys: string[] =
        [];

      for (
        let i = 0;
        i <
        localStorage.length;
        i++
      ) {
        const key =
          localStorage.key(
            i,
          );

        if (
          key?.startsWith(
            CACHE_PREFIX,
          )
        ) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        localStorage.removeItem(
          key,
        );
      }
    } catch {
      /* Ignore. */
    }
  };
