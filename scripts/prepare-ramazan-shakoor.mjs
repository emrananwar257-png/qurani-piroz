import { mkdir, stat, writeFile, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const SURAH_LIST = [
  1, 2, 3, 9, 10, 12, 13, 14, 23, 24, 26, 29, 35, 36, 39, 40, 42, 43,
  47, 48, 49, 50, 51, 57, 58, 59, 60, 63, 68, 69, 70, 71, 72, 82, 83,
  84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
  101, 102, 103, 104, 105, 106, 107, 108, 109, 111, 112, 113, 114
];

const AUDIO_BASE = 'https://server6.mp3quran.net/download/shakoor/';
const TIMING_ENDPOINTS = [
  'https://mp3quran.net/api/v3/ayat_timing',
  'https://mp3quran.net/api/ayat_timing',
  'https://mp3quran.de/api/v3/ayat_timing',
  'https://mp3quran.de/api/ayat_timing'
];
const TIMING_READ_ID = 227;
const AUDIO_DIR = 'public/ramazan-shukur';
const TIMING_DIR = 'public/ayah-timings/ramazan_shukur';
const CONCURRENCY = 4;


const existsAndNonEmpty = async (path) => {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
};

const fetchOrThrow = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'qurani-piroz-build/1.0' }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response;
};

const prepareSurah = async (surah) => {
  const id = String(surah).padStart(3, '0');
  const audioPath = `${AUDIO_DIR}/${id}.mp3`;
  const audioPart = `${audioPath}.part`;
  const timingPath = `${TIMING_DIR}/${id}.json`;
  const timingPart = `${timingPath}.part`;

  if (!(await existsAndNonEmpty(audioPath))) {
    console.log(`Downloading Ramadan Shakoor audio ${id}.mp3...`);
    const response = await fetchOrThrow(`${AUDIO_BASE}${id}.mp3`);

    if (!response.body) {
      throw new Error(`Empty audio body for surah ${surah}`);
    }

    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(audioPart)
    );
    await rename(audioPart, audioPath);
  }

  if (!(await existsAndNonEmpty(timingPath))) {
    console.log(`Downloading Ramadan Shakoor timing ${id}.json...`);
    let response = null;
    let payload = null;

    for (const endpoint of TIMING_ENDPOINTS) {
      try {
        const candidate = await fetchOrThrow(
          `${endpoint}?surah=${surah}&read=${TIMING_READ_ID}`
        );
        const candidatePayload = await candidate.json();
        const candidateRaw = Array.isArray(candidatePayload)
          ? candidatePayload
          : Array.isArray(candidatePayload?.data)
          ? candidatePayload.data
          : Array.isArray(candidatePayload?.timing)
          ? candidatePayload.timing
          : Array.isArray(candidatePayload?.ayahs)
          ? candidatePayload.ayahs
          : [];

        if (candidateRaw.length) {
          response = candidate;
          payload = candidatePayload;
          break;
        }
      } catch {
        // Try the next documented/legacy endpoint.
      }
    }

    if (!payload) {
      throw new Error(
        `No Ramadan Shakoor timing data found for surah ${surah} using read ${TIMING_READ_ID}`
      );
    }

    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.timing)
      ? payload.timing
      : Array.isArray(payload?.ayahs)
      ? payload.ayahs
      : [];;

    const payload = await response.json();
    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.timing)
      ? payload.timing
      : Array.isArray(payload?.ayahs)
      ? payload.ayahs
      : [];

    const timings = raw
      .map((item) => ({
        ayah: Number(item?.ayah ?? item?.ayah_number ?? item?.number),
        start_time:
          Number(item?.start_time ?? item?.start ?? item?.startTime) / 1000,
        end_time:
          Number(item?.end_time ?? item?.end ?? item?.endTime) / 1000
      }))
      .filter(
        (item) =>
          Number.isFinite(item.ayah) &&
          item.ayah > 0 &&
          Number.isFinite(item.start_time) &&
          Number.isFinite(item.end_time) &&
          item.end_time > item.start_time
      )
      .sort((x, y) => x.ayah - y.ayah);

    if (!timings.length) {
      throw new Error(`Empty timing data for surah ${surah}`);
    }

    await writeFile(timingPart, JSON.stringify(timings));
    await rename(timingPart, timingPath);
  }

  console.log(`Ready: Ramadan Shakoor ${id}`);
};

await mkdir(AUDIO_DIR, { recursive: true });
await mkdir(TIMING_DIR, { recursive: true });

console.log(`Preparing ${SURAH_LIST.length} Ramadan Shakoor surahs locally...`);

for (let i = 0; i < SURAH_LIST.length; i += CONCURRENCY) {
  const batch = SURAH_LIST.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map((surah) => prepareSurah(surah)));
}

console.log('Ramadan Shakoor local assets are ready.');
