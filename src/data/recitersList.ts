export interface ReciterItem {
  id: string;
  name: string;
  subName?: string;
  category:
    | 'kurdish'
    | 'kurdish_tafsir'
    | 'famous'
    | 'riwayat'
    | 'teaching';
  riwayah: string;
  serverKey: string;

  /**
   * Audio source type.
   *
   * everyayah:
   * Per-ayah MP3:
   * 001001.mp3, 001002.mp3, ...
   *
   * mp3quran:
   * Per-surah MP3 with timing from MP3Quran when available.
   *
   * gapless:
   * Per-surah MP3 + official SQLite ayah timing database.
   *
   * Both sources are handled by MushafPageView.
   */
  audioSource?: 'everyayah' | 'mp3quran' | 'gapless' | 'ramadan_shakoor';

  /**
   * Base URL for MP3Quran or gapless reciters.
   */
  audioBaseUrl?: string;

  /**
   * SQLite gapless timing database URL.
   * Used when audioSource === 'gapless'.
   */
  timingDbUrl?: string;

  /**
   * ئەگەر نەبوو، واتە هەموو ١١٤ سورەت بەردەستن.
   * ئەگەر بوو، تەنها ژمارە سورەتەکانی ناو ئەم لیستە بەردەستن.
   */
  availableSurahs?: number[];
}

export const ALL_RECITERS_DIRECTORY: ReciterItem[] = [
  // ==========================================
  // ١. قورئانخوێنە دەنگخۆشەکانی کوردستان
  // ==========================================

  {
    id: 'peshawa_kurdi',
    name: 'پێشەوا قادر کوردی',
    subName: 'Peshawa Qadr Al-Kurdi',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Peshawa_Kurdi',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://server16.mp3quran.net/peshawa/Rewayat-Hafs-A-n-Assem/'
  },

  {
    id: 'raad_kurdi',
    name: 'ڕەعد محەمەد کوردی',
    subName: 'Raad Al-Kurdi',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Raad_Al_Kurdi',
    audioSource: 'gapless',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/Raad/',
    timingDbUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/Raad/raad_al_kurdi.db'
  },

  {
    id: 'rizgar_kurdi',
    name: 'ڕزگار محەمەد کوردی',
    subName: 'Rizgar Muhammad Kurdi',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Rizgar_Kurdi',
    audioSource: 'gapless',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/rzgar_kurdi_mutasil/',
    timingDbUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/rzgar_kurdi_mutasil/rzgar_kurdi_mutasil.db'
  },

  {
    id: 'abdulhadi_kurdi',
    name: 'عەبدولهادی کوردی',
    subName: 'Abdulhadi Kurdi',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Abdulhadi_Kurdi',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/abdulhadi_kurdi_mutasil/'
  },

  {
    id: 'dilshad_kurdi',
    name: 'دڵشاد ئەحمەد کوردی',
    subName: 'Dilshad Ahmad Kurdi',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Dilshad_Kurdi',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/dlshad/'
  },

  {
    id: 'farman_shwani',
    name: 'فەرمان شوانی کوردی',
    subName: 'Farman Shwani',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Farman_Shwani',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/farman/'
  },

  {
    id: 'hamza_barzanji',
    name: 'حەمزە بەرزنجی کوردی',
    subName: 'Hamza Barzanji',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Hamza_Barzanji',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/hamza/'
  },

  {
    id: 'sherzad_kurdi',
    name: 'شێرزاد عەبدولڕەحمان کوردی',
    subName: 'Sherzad Abdulrahman',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Sherzad_Kurdi',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/sherzad/'
  },

  {
    id: 'ubaydah_kurdi',
    name: 'عوبەیدە موەفەق کوردی',
    subName: 'Ubaydah Muwaffaq',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Ubaydah_Kurdi',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/ubeda_kurdi_mutasil/'
  },

  {
    id: 'ramazan_shukur',
    name: 'ڕەمەزان شکوور کوردی',
    subName: 'Ramadan Shukur',
    category: 'kurdish',
    riwayah: 'حەفس لەسەر عاسم',
    serverKey: 'Ramazan_Shukur',
    audioSource: 'ramadan_shakoor',
    audioBaseUrl:
      'https://server6.mp3quran.net/shakoor/',
    availableSurahs: [1, 2, 3, 9, 10, 12, 13, 14, 23, 24, 26, 29, 35, 36, 39, 40, 42, 43, 47, 48, 49, 50, 51, 57, 58, 59, 60, 63, 68, 69, 70, 71, 72, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 111, 112, 113, 114]
  },

  // ==========================================
  // ٢. دەنگی قورئان لەگەڵ تەفسیری کوردی
  // ==========================================

  {
    id: 'handren_tafsir',
    name: 'هەندڕێن کوردی (تەنها تەفسیری دەنگی)',
    subName: 'Handren (Kurdish Audio Tafsir)',
    category: 'kurdish_tafsir',
    riwayah: 'تەفسیری کوردی',
    serverKey: 'Handren_Tafsir',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/sounds010/releases/download/handren_tanha_tafser/'
  },

  {
    id: 'ghamdi_handren_asan',
    name: 'سەعد غامدی و هەندڕێن کوردی',
    subName: 'Ghamdi with Kurdish Tafsir Asan',
    category: 'kurdish_tafsir',
    riwayah: 'قورئان + تەفسیری ئاسان',
    serverKey: 'Ghamdi_Handren_Asan',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/qari_kurdi_mutasil/releases/download/ghamdi_handren_kurdi/'
  },

  {
    id: 'ghamdi_tahsin_badini',
    name: 'تەحسین دۆسکی و سەعد غامدی',
    subName: 'Ghamdi with Kurdish Tafsir Badini',
    category: 'kurdish_tafsir',
    riwayah: 'قورئان + تەفسیری سەناهی بادینی',
    serverKey: 'Tahsin_Doski_Sanahi',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/audio002/releases/download/Tahsin_doski_sanahi/'
  },

  {
    id: 'naqshbandi_badini',
    name: 'د. محەمەد سەعید نەقشبەندی کوردی',
    subName: 'Dr. Muhammad Said (Tafsir Badini)',
    category: 'kurdish_tafsir',
    riwayah: 'تەفسیری بادینی',
    serverKey: 'Naqshbandi_Badini',
    audioSource: 'mp3quran',
    audioBaseUrl:
      'https://github.com/Hiwaselah/audio002/releases/download/d_mhamad_sa3id/'
  },

  // ==========================================
  // ٣. قورئانخوێنە ناودارە جیهانییەکان
  // ==========================================

  {
    id: 'alafasy',
    name: 'ميشاري بن راشد العفاسي',
    subName: 'Mishary Rashid Alafasy',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Alafasy_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdul_basit_murattal',
    name: 'عبد الباسط عبد الصمد (مرتل)',
    subName: 'Abdul Basit (Murattal)',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abdul_Basit_Murattal_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdul_basit_mujawwad',
    name: 'عبد الباسط عبد الصمد (مجود)',
    subName: 'Abdul Basit (Mujawwad)',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abdul_Basit_Mujawwad_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'minshawy_murattal',
    name: 'محمد صديق المنشاوي (مرتل)',
    subName: 'Al-Minshawy (Murattal)',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Minshawy_Murattal_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'minshawy_mujawwad',
    name: 'محمد صديق المنشاوي (مجود)',
    subName: 'Al-Minshawy (Mujawwad)',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Minshawy_Mujawwad_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'husary_murattal',
    name: 'محمود خليل الحصري (مرتل)',
    subName: 'Al-Husary (Murattal)',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Husary_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'husary_mujawwad',
    name: 'محمود خليل الحصري (مجود)',
    subName: 'Al-Husary (Mujawwad)',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Husary_Mujawwad_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'maher_muaiqly',
    name: 'ماهر المعيقلي',
    subName: 'Maher Al-Muaiqly',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Maher_AlMuaiqly_64kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'saad_ghamdi',
    name: 'سعد الغامدي',
    subName: 'Saad Al-Ghamdi',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Ghamadi_40kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'yasser_dosari',
    name: 'ياسر الدوسري',
    subName: 'Yasser Al-Dosari',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Yasser_Ad-Dussary_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'sudais',
    name: 'عبد الرحمن السديس',
    subName: 'Abdurrahman As-Sudais',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abdurrahmaan_As-Sudais_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'shuraim',
    name: 'سعود الشريم',
    subName: 'Saud Ash-Shuraim',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Saood_ash-Shuraym_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'ahmed_ajamy',
    name: 'أحمد بن علي العجمي',
    subName: 'Ahmed Al-Ajamy',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Ahmed_ibn_Ali_al-Ajamy_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abu_bakr_shatri',
    name: 'أبو بكر الشاطري',
    subName: 'Abu Bakr Al-Shatri',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abu_Bakr_Ash-Shaatree_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'idrees_abkar',
    name: 'إدريس أبكر',
    subName: 'Idrees Abkar',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Idrees_Abkar_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'nasser_qatami',
    name: 'ناصر القطامي',
    subName: 'Nasser Al-Qatami',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Nasser_Alqatami_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'ali_jaber',
    name: 'علي عبد الله جابر',
    subName: 'Ali Jaber',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Ali_Jaber_64kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'muhammad_ayyub',
    name: 'محمد أيوب',
    subName: 'Muhammad Ayyub',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Muhammad_Ayyoob_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'muhammad_jibreel',
    name: 'محمد جبريل',
    subName: 'Muhammad Jibreel',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Muhammad_Jibreel_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'khalid_jalil',
    name: 'خالد الجليل',
    subName: 'Khalid Al-Jaleel',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Khalid_AlJaleel_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'khalid_qahtani',
    name: 'خالد القحطاني',
    subName: 'Khalid Al-Qahtani',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Khaalid_Al-Qahtaanee_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdullah_juhany',
    name: 'عبد الله الجهني',
    subName: 'Abdullah Al-Juhany',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abdullah_Al-Juhany_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdullah_basfar',
    name: 'عبد الله بصفر',
    subName: 'Abdullah Basfar',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abdullah_Basfar_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdulmohsen_qasim',
    name: 'عبد المحسن القاسم',
    subName: 'Abdulmohsen Al-Qasim',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Abdulmohsen_Al-Qasim_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'fares_abbad',
    name: 'فارس عباد',
    subName: 'Fares Abbad',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Fares_Abbad_64kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'hudhaify',
    name: 'علي بن عبد الرحمن الحذيفي',
    subName: 'Ali Al-Hudhaify',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Hudhaify_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'hani_rifai',
    name: 'هاني الرفاعي',
    subName: 'Hani Ar-Rifai',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Hani_Rifai_192kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'ayman_suwaid',
    name: 'د. أيمن سويد',
    subName: 'Dr. Ayman Suwaid',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Ayman_Sowaid_64kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'tariq_ibrahim',
    name: 'إبراهيم الأخضر',
    subName: 'Ibrahim Al-Akhdar',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Ibrahim_Akhdar_32kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'wadih_yamani',
    name: 'وديع اليمني',
    subName: 'Wadih Al-Yamani',
    category: 'famous',
    riwayah: 'حفص عن عاصم',
    serverKey: 'Wadih_Al-Yamani_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'nourin_siddeeq',
    name: 'نورين محمد صديق',
    subName: 'Nourin Mohamed Siddiq',
    category: 'famous',
    riwayah: 'الدوري عن أبي عمرو',
    serverKey: 'Nourin_Siddiq_128kbps',
    audioSource: 'everyayah'
  },

  // ==========================================
  // ٤. خوێندنەوە بە ڕیوایەتە جیاوازەکان
  // ==========================================

  {
    id: 'yassin_aljazairi_warsh',
    name: 'ياسين الجزائري (رواية ورش)',
    subName: 'Yassin Al-Jazaery (Warsh)',
    category: 'riwayat',
    riwayah: 'ورش عن نافع',
    serverKey: 'Yassin_AlJazaery_Warsh_64kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'khamiri_shubah',
    name: 'فؤاد الخامري (رواية شعبة)',
    subName: "Fouad Al-Khamiri (Shu'bah)",
    category: 'riwayat',
    riwayah: 'شعبة عن عاصم',
    serverKey: 'Khamiri_Shubah_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'miftah_saltany_duri',
    name: 'مفتاح السلطني (رواية الدوري)',
    subName: 'Miftah As-Saltany (Al-Duri)',
    category: 'riwayat',
    riwayah: 'الدوري عن أبي عمرو',
    serverKey: 'Saltany_Duri_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdulrashid_sofi_susi',
    name: 'عبد الرشيد صوفي (رواية السوسي)',
    subName: 'Abdulrasheed Soufi (Al-Susi)',
    category: 'riwayat',
    riwayah: 'السوسي عن أبي عمرو',
    serverKey: 'Soufi_Susi_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'abdulrashid_sofi_khalaf',
    name: 'عبد الرشيد صوفي (رواية خلف عن حمزة)',
    subName: 'Abdulrasheed Soufi (Khalaf)',
    category: 'riwayat',
    riwayah: 'خلف عن حمزة',
    serverKey: 'Soufi_Khalaf_128kbps',
    audioSource: 'everyayah'
  },

  // ==========================================
  // ٥. دەنگی فێرکاری و منداڵان
  // ==========================================

  {
    id: 'husary_muallim',
    name: 'الحصري (المصحف المعلم)',
    subName: 'Al-Husary (Teacher Mode)',
    category: 'teaching',
    riwayah: 'حفص (معلم)',
    serverKey: 'Husary_Muallim_128kbps',
    audioSource: 'everyayah'
  },

  {
    id: 'minshawy_children',
    name: 'المنشاوي (مع الأطفال - ترديد)',
    subName: 'Al-Minshawy (With Children)',
    category: 'teaching',
    riwayah: 'حفص (ترديد)',
    serverKey: 'Minshawy_Teacher_128kbps',
    audioSource: 'everyayah'
  }
];
