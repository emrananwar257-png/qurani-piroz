// src/utils/quranAudioDb.ts

const DB_NAME = 'QuranAudioCacheDB';
const DB_VERSION = 1;
const SURAH_STORE = 'surah_audio';
const AYAH_STORE = 'ayah_audio';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SURAH_STORE)) {
        db.createObjectStore(SURAH_STORE);
      }
      if (!db.objectStoreNames.contains(AYAH_STORE)) {
        db.createObjectStore(AYAH_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSurahAudio(reciterId: string, surahNumber: number): Promise<Blob | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(SURAH_STORE, 'readonly');
      const store = tx.objectStore(SURAH_STORE);
      const key = `${reciterId}_${surahNumber}`;
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as Blob) || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveSurahAudio(reciterId: string, surahNumber: number, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SURAH_STORE, 'readwrite');
      const store = tx.objectStore(SURAH_STORE);
      const key = `${reciterId}_${surahNumber}`;
      const request = store.put(blob, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Ignore storage errors if full
  }
}

export async function getAyahAudio(reciterId: string, surahNumber: number, ayahNumber: number): Promise<Blob | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(AYAH_STORE, 'readonly');
      const store = tx.objectStore(AYAH_STORE);
      const key = `${reciterId}_${surahNumber}_${ayahNumber}`;
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as Blob) || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveAyahAudio(reciterId: string, surahNumber: number, ayahNumber: number, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AYAH_STORE, 'readwrite');
      const store = tx.objectStore(AYAH_STORE);
      const key = `${reciterId}_${surahNumber}_${ayahNumber}`;
      const request = store.put(blob, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Ignore storage errors if full
  }
}
