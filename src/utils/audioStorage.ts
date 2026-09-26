const DB_NAME = 'quran_audio_db';
const STORE_NAME = 'audio';
const DB_VERSION = 2;

export type AudioRecord = {
  key: string;
  blob: Blob;
  reciterId: string;
  surahNumber: number;
  ayahNumber?: number;
  type: 'ayah' | 'surah';
  createdAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/*
|--------------------------------------------------------------------------
| KEYS GENERATOR
|--------------------------------------------------------------------------
*/

export function makeAudioKey(reciterId: string, surahNumber: number, ayahNumber: number) {
  return `ayah::${reciterId}_${surahNumber}_${ayahNumber}`;
}

export function makeSurahAudioKey(reciterId: string, surahNumber: number) {
  return `surah::${reciterId}_${surahNumber}`;
}

/*
|--------------------------------------------------------------------------
| SAVE & GET AYAH (EveryAyah Source)
|--------------------------------------------------------------------------
*/

export async function saveAyahAudio(
  reciterId: string,
  surahNumber: number,
  ayahNumber: number,
  blob: Blob
) {
  const db = await openDB();
  const record: AudioRecord = {
    key: makeAudioKey(reciterId, surahNumber, ayahNumber),
    blob,
    reciterId,
    surahNumber,
    ayahNumber,
    type: 'ayah',
    createdAt: Date.now(),
  };

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAyahAudio(
  reciterId: string,
  surahNumber: number,
  ayahNumber: number
): Promise<Blob | null> {
  const db = await openDB();
  const key = makeAudioKey(reciterId, surahNumber, ayahNumber);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => {
      const record = request.result as AudioRecord | undefined;
      db.close();
      resolve(record?.type === 'ayah' ? record.blob : null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function isAyahDownloaded(
  reciterId: string,
  surahNumber: number,
  ayahNumber: number
): Promise<boolean> {
  const blob = await getAyahAudio(reciterId, surahNumber, ayahNumber);
  return !!blob;
}

/*
|--------------------------------------------------------------------------
| SAVE & GET FULL SURAH (MP3Quran Source)
|--------------------------------------------------------------------------
*/

export async function saveSurahAudio(reciterId: string, surahNumber: number, blob: Blob) {
  const db = await openDB();
  const record: AudioRecord = {
    key: makeSurahAudioKey(reciterId, surahNumber),
    blob,
    reciterId,
    surahNumber,
    type: 'surah',
    createdAt: Date.now(),
  };

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getSurahAudio(reciterId: string, surahNumber: number): Promise<Blob | null> {
  const db = await openDB();
  const key = makeSurahAudioKey(reciterId, surahNumber);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => {
      const record = request.result as AudioRecord | undefined;
      db.close();
      resolve(record?.type === 'surah' ? record.blob : null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function isSurahAudioDownloaded(
  reciterId: string,
  surahNumber: number
): Promise<boolean> {
  const blob = await getSurahAudio(reciterId, surahNumber);
  return !!blob;
}

/*
|--------------------------------------------------------------------------
| COUNT & HELPERS
|--------------------------------------------------------------------------
*/

export async function getDownloadedAyahCount(
  reciterId: string,
  surahNumber: number,
  ayahCount: number
): Promise<number> {
  if (ayahCount <= 0) return 0;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let checked = 0;
    let count = 0;

    for (let ayah = 1; ayah <= ayahCount; ayah++) {
      const request = store.get(makeAudioKey(reciterId, surahNumber, ayah));

      request.onsuccess = () => {
        checked++;
        const record = request.result as AudioRecord | undefined;
        if (record && record.type === 'ayah' && record.blob) {
          count++;
        }
        if (checked === ayahCount) {
          db.close();
          resolve(count);
        }
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    }
  });
}

export async function isSurahDownloaded(
  reciterId: string,
  surahNumber: number,
  ayahCount: number
): Promise<boolean> {
  const count = await getDownloadedAyahCount(reciterId, surahNumber, ayahCount);
  return count === ayahCount;
}

/*
|--------------------------------------------------------------------------
| DELETE AUDIO (Deletes both Whole Surah & Individual Ayahs)
|--------------------------------------------------------------------------
*/

export async function deleteSurahAudio(
  reciterId: string,
  surahNumber: number,
  ayahCount: number
) {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // ١. سڕینەوەی بەستەری تەواوی سوورەت (MP3Quran)
    store.delete(makeSurahAudioKey(reciterId, surahNumber));

    // ٢. سڕینەوەی ئایەت بە ئایەتەکان (EveryAyah)
    for (let ayah = 1; ayah <= ayahCount; ayah++) {
      store.delete(makeAudioKey(reciterId, surahNumber, ayah));
    }

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
