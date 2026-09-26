export type AppThemeMode = 'minimalist-dark' | 'madinah-mushaf' | 'soft-modern';
export type BgThemeType = 'white' | 'cream' | 'dark';
export type AppLangType = 'ku' | 'ar' | 'en';
export type AccentColorType = 'gold' | 'emerald' | 'blue';

export interface SurahItem {
  number: number;
  nameAr: string;
  nameKu: string;
  nameEn: string;
  typeKu: string;
  typeAr: string;
  typeEn: string;
  ayahs: number;
  startPage: number;
}

export interface SurahHeader {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface AyahDetail {
  numberInSurah: number;
  arabicText: string;
  kurdishTranslation: string;
  audioUrl: string;
}

export interface KurdishTafsirOption {
  id: string;
  name: string;
  author: string;
  language: string;
}

export interface DhikrItem {
  id: string;
  arabic: string;
  kurdish: string;
  count: number;
  virtue?: string;
}

export interface DhikrCategory {
  id: string;
  title: string;
  items: DhikrItem[];
}

export interface CityPrayerData {
  id: string;
  name: string;
  qiblaAngle: number;
}

export interface SeerahChapter {
  id: number;
  title: string;
  era: string;
  summary: string;
  content: string;
}

export interface SahabiBio {
  name: string;
  title: string;
  category: 'khulafa' | 'mubashirun' | 'mothers' | 'commanders' | 'women';
  description: string;
}

export interface ScholarProfile {
  id: string;
  name: string;
  title: string;
  bio: string;
  books: string[];
  audioSeriesTitle: string;
}

export interface QuizItem {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  rewardHasanat: number;
  rewardText: string;
}

export interface ReciterItem {
  id: string;
  name: string;
  subName?: string;
  category: 'kurdish' | 'kurdish_tafsir' | 'famous' | 'riwayat' | 'teaching';
  riwayah: string;
  serverKey: string;
  /** جۆری سەرچاوەی دەنگ: mp3quran = فایلی جیاواز بۆ هەر سورەت (٠٠١.mp3...١١٤.mp3) */
  audioSource?: 'mp3quran' | 'everyayah';
  /** بنەڕەتی لینکی دابەزاندنی دەنگ (کۆتایی بە / بێت) */
  audioBaseUrl?: string;
  /** ئەگەر نەبوو، واتە هەموو ١١٤ سورەت بەردەستن. ئەگەر بوو، تەنها ژمارە سورەتەکانی ناو ئەم لیستە بەردەستن. */
  availableSurahs?: number[];
}

export interface TafsirItem {
  id: string;
  title: string;
  author: string;
  category: 'kurdish' | 'arabic' | 'english' | 'persian' | 'global';
  language: string;
}
