export interface TafsirItem {
  id: string;
  title: string;
  author: string;
  category: 'kurdish' | 'arabic' | 'english' | 'persian' | 'global';
  language: string;

  // ناسنامەی edition ـی API ـی Al Quran Cloud
  // ئەگەر نەبوو، واتە ئەم تەفسیرە هێشتا بە API ـەکە نەبەستراوەتەوە.
  apiEdition?: string;
}

export const ALL_TAFSIRS_DIRECTORY: TafsirItem[] = [

  // =========================================================
  // ١. تەفسیرە کوردییەکان
  // =========================================================

  {
    id: 'ku_asan',
    title: 'تەفسیری ئاسان',
    author: 'مامۆستا بورهان موحەممەد ئەمین',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)',
    apiEdition: 'ku.asan'
  },

  {
    id: 'ku_nami',
    title: 'تەفسیری نامی',
    author: 'مامۆستا مەلا عەبدولکەریمی مودەڕڕیس',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_ali_bapir',
    title: 'تەفیری قورئانی بەرز و بەپێز',
    author: 'مامۆستا عەلی باپیر',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_rebar',
    title: 'تەفسەیری ڕێبەر',
    author: 'پێشەوا مامۆستا مەلا عوسمان عەبدولعەزیز',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_raman',
    title: 'تەفسیری ڕامان',
    author: 'مامۆستا ئەحمەد کاکە مەحموود',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_pukhta',
    title: 'پوختەی قورئان',
    author: 'مامۆستا مەلا موحەممەد کۆیی',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_hajar',
    title: 'تەفسیری هەژار موکریانی',
    author: 'مامۆستا هەژار موکریانی',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_muyasar',
    title: 'تەفسیری مویەسەر',
    author: 'تەفسیری مویەسەری کوردی',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_roshan',
    title: 'تەفسیری ڕۆشن',
    author: 'تەفسیری ڕۆشن',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_tawhid',
    title: 'تەفسیری تەوحید',
    author: 'تەفسیری تەوحید',
    category: 'kurdish',
    language: 'کوردی (سۆرانی)'
  },

  {
    id: 'ku_sanahi',
    title: 'تەفسیری سەناهی',
    author: 'تەفسیری سەناهی بادینی',
    category: 'kurdish',
    language: 'کوردی (بادینی)'
  },

  {
    id: 'ku_ronahi',
    title: 'تەفسیری ڕۆناهی بادینی',
    author: 'تەفسیری ڕۆناهی',
    category: 'kurdish',
    language: 'کوردی (بادینی)'
  },

  {
    id: 'ku_zhian',
    title: 'تەفسیری ژیان بادینی',
    author: 'تەفسیری ژیان',
    category: 'kurdish',
    language: 'کوردی (بادینی)'
  },

  {
    id: 'ku_latini',
    title: 'تەفسیری کوردی لاتینی بادینی',
    author: 'تەفسیری لاتینی',
    category: 'kurdish',
    language: 'کوردی (لاتینی)'
  },


  // =========================================================
  // ٢. تەفسیرە عەرەبییەکان
  // =========================================================

  {
    id: 'ar_muyassar',
    title: 'التفسير الميسر',
    author: 'مجمع الملك فهد لطباعة المصحف',
    category: 'arabic',
    language: 'العربية',
    apiEdition: 'ar.muyassar'
  },

  {
    id: 'ar_jalalayn',
    title: 'تفسير الجلالين',
    author: 'جلال الدين المحلي والسيوطي',
    category: 'arabic',
    language: 'العربية',
    apiEdition: 'ar.jalalayn'
  },

  {
    id: 'ar_kathir',
    title: 'تفسير ابن كثير',
    author: 'عماد الدين بن كثير',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_saadi',
    title: 'تفسير السعدي (تيسير الكريم الرحمن)',
    author: 'الشيخ عبد الرحمن السعدي',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_tabari',
    title: 'تفسير الطبري (جامع البيان)',
    author: 'الإمام محمد بن جرير الطبري',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_qurtubi',
    title: 'تفسير القرطبي (الجامع لأحكام القرآن)',
    author: 'الإمام القرطبي',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_baghawi',
    title: 'تفسير البغوي',
    author: 'الإمام البغوي',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_tahrir',
    title: 'التحرير والتنوير',
    author: 'الشيخ محمد الطاهر بن عاشور',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_waseet',
    title: 'التفسير الوسيط',
    author: 'مجمع التفسير الوسيط',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_mukhtasar',
    title: 'التفسير المختصر',
    author: 'مركز تفسير للدراسات القرآنية',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_asbab',
    title: 'أسباب النزول',
    author: 'الإمام الواحدي النيسابوري',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_iirab_daas',
    title: 'كتاب إعراب القرآن للدعاس',
    author: 'أحمد بن محمد الدعاس',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_iirab_center',
    title: 'إعراب القرآن - مركز تفسير',
    author: 'مركز تفسير',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_sarraj',
    title: 'السراج في بيان غريب القرآن',
    author: 'محمد بن عبد العزيز الخضيري',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_hidayat',
    title: 'هدايات القرآن الكريم',
    author: 'هدايات القرآن الكريم',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_qiraat',
    title: 'موسوعة القراءات القرآنية',
    author: 'موسوعة القراءات',
    category: 'arabic',
    language: 'العربية'
  },

  {
    id: 'ar_suwar_cards',
    title: 'بطاقات صور القرآن',
    author: 'مركز بطاقات القرآن',
    category: 'arabic',
    language: 'العربية'
  },


  // =========================================================
  // ٣. وەرگێڕانە ئینگلیزییەکان
  // =========================================================

  {
    id: 'en_sahih',
    title: 'Sahih International',
    author: 'Sahih International',
    category: 'english',
    language: 'English',
    apiEdition: 'en.sahih'
  },

  {
    id: 'en_pickthall',
    title: 'English Translation (Pickthall)',
    author: 'Mohammed Marmaduke Pickthall',
    category: 'english',
    language: 'English',
    apiEdition: 'en.pickthall'
  },

  {
    id: 'en_yusuf_ali',
    title: 'English Translation (Yusuf Ali)',
    author: 'Abdullah Yusuf Ali',
    category: 'english',
    language: 'English',
    apiEdition: 'en.yusufali'
  },

  {
    id: 'en_hilali_khan',
    title: 'English Translation (Khan / Hilali)',
    author: 'Muhammad Taqi-ud-Din al-Hilali & Muhsin Khan',
    category: 'english',
    language: 'English',
    apiEdition: 'en.hilali'
  },

  {
    id: 'en_clear_quran',
    title: 'The Clear Quran',
    author: 'Dr. Mustafa Khattab',
    category: 'english',
    language: 'English'
  },

  {
    id: 'en_abdul_haleem',
    title: 'English Translation (Abdul Haleem)',
    author: 'M. A. S. Abdel Haleem (Oxford)',
    category: 'english',
    language: 'English'
  },

  {
    id: 'en_bridges',
    title: 'English Translation (Bridges Foundation)',
    author: 'Fadel Soliman',
    category: 'english',
    language: 'English'
  },

  {
    id: 'en_taqi_usmani',
    title: 'English Translation (Mufti Taqi Usmani)',
    author: 'Mufti Muhammad Taqi Usmani',
    category: 'english',
    language: 'English'
  },

  {
    id: 'en_transliteration',
    title: 'English Transliteration',
    author: 'Quran Transliteration',
    category: 'english',
    language: 'English',
    apiEdition: 'en.transliteration'
  },


  // =========================================================
  // ٤. فارسی
  // =========================================================

  {
    id: 'fa_ahsan_kalam',
    title: 'تفسیر فارسی احسن الکلام',
    author: 'حسین تاجی گله‌داری',
    category: 'persian',
    language: 'فارسی'
  },

  {
    id: 'fa_islamhouse',
    title: 'ترجمه و تفسیر فارسی اسلام‌هاوس',
    author: 'Islamhouse Persian Team',
    category: 'persian',
    language: 'فارسی'
  },


  // =========================================================
  // ٥. زمانە جیهانییەکان
  // =========================================================

  {
    id: 'tr_diyanet',
    title: 'Turkish Translation (Diyanet İşleri)',
    author: 'Diyanet İşleri Başkanlığı',
    category: 'global',
    language: 'Türkçe',
    apiEdition: 'tr.diyanet'
  },

  {
    id: 'tr_elmali',
    title: 'Turkish Translation (Elmalılı Hamdi Yazır)',
    author: 'Elmalılı Muhammed Hamdi Yazır',
    category: 'global',
    language: 'Türkçe',
    apiEdition: 'tr.yazir'
  },

  {
    id: 'de_bubenheim',
    title: 'German Translation',
    author: 'A. S. F. Bubenheim and N. Elyas',
    category: 'global',
    language: 'Deutsch',
    apiEdition: 'de.bubenheim'
  },

  {
    id: 'fr_hamidullah',
    title: 'French Translation',
    author: 'Muhammad Hamidullah',
    category: 'global',
    language: 'Français',
    apiEdition: 'fr.hamidullah'
  },

  {
    id: 'ru_kuliev',
    title: 'Russian Translation (Elmir Kuliev)',
    author: 'Elmir Kuliev',
    category: 'global',
    language: 'Русский',
    apiEdition: 'ru.kuliev'
  },

  {
    id: 'ru_abu_adel',
    title: 'Russian Translation (Abu Adel)',
    author: 'Abu Adel',
    category: 'global',
    language: 'Русский',
    apiEdition: 'ru.abualih'
  },

  {
    id: 'es_cortes',
    title: 'Spanish Translation (Julio Cortes)',
    author: 'Julio Cortes',
    category: 'global',
    language: 'Español',
    apiEdition: 'es.cortes'
  },

  {
    id: 'es_garcia',
    title: 'Spanish Translation (Isa Garcia)',
    author: 'Sheikh Isa Garcia',
    category: 'global',
    language: 'Español'
  },

  {
    id: 'ur_maududi',
    title: 'Urdu Translation (Abul A\'la Maududi)',
    author: 'Syed Abul A\'la Maududi',
    category: 'global',
    language: 'اردو',
    apiEdition: 'ur.maududi'
  },

  {
    id: 'ur_junagarhi',
    title: 'Urdu Translation (Muhammad Junagarhi)',
    author: 'Maulana Muhammad Junagarhi',
    category: 'global',
    language: 'اردو',
    apiEdition: 'ur.junagarhi'
  },

  {
    id: 'id_sabeq',
    title: 'Indonesian Translation',
    author: 'Sabeq Company / Ministry of Religious Affairs',
    category: 'global',
    language: 'Bahasa Indonesia',
    apiEdition: 'id.indonesian'
  },

  {
    id: 'ms_basmeih',
    title: 'Malay Translation',
    author: 'Abdullah Muhammad Basmeih',
    category: 'global',
    language: 'Bahasa Melayu',
    apiEdition: 'ms.basmeih'
  },

  {
    id: 'sq_nahi',
    title: 'Albanian Translation',
    author: 'Hasan Nahi',
    category: 'global',
    language: 'Shqip',
    apiEdition: 'sq.nahi'
  },

  {
    id: 'am_sadiq',
    title: 'Amharic Translation',
    author: 'Muhammed Sadiq and Muhammed Sani Habib',
    category: 'global',
    language: 'አማርኛ',
    apiEdition: 'am.sadiq'
  },

  {
    id: 'az_musayev',
    title: 'Azerbaijani Translation',
    author: 'Alikhan Musayev',
    category: 'global',
    language: 'Azərbaycan',
    apiEdition: 'az.musayev'
  },

  {
    id: 'bn_zakaria',
    title: 'Bengali Translation',
    author: 'Abu Bakr Zakaria',
    category: 'global',
    language: 'বাংলা',
    apiEdition: 'bn.bengali'
  },

  {
    id: 'bs_mehanovic',
    title: 'Bosnian Translation (Mehanovic)',
    author: 'Muhamed Mehanović',
    category: 'global',
    language: 'Bosanski'
  },

  {
    id: 'bs_korkut',
    title: 'Bosnian Translation (Besim Korkut)',
    author: 'Besim Korkut',
    category: 'global',
    language: 'Bosanski',
    apiEdition: 'bs.korkut'
  },

  {
    id: 'zh_majian',
    title: 'Chinese Translation',
    author: 'Ma Jian (Simplified)',
    category: 'global',
    language: '中文',
    apiEdition: 'zh.jian'
  },

  {
    id: 'nl_abdalsalaam',
    title: 'Dutch Translation',
    author: 'M. F. Abdassalaam',
    category: 'global',
    language: 'Nederlands',
    apiEdition: 'nl.keyzer'
  },

  {
    id: 'tl_rowwad',
    title: 'Filipino (Tagalog) Translation',
    author: 'Rowwad Center and Islamhouse',
    category: 'global',
    language: 'Tagalog'
  },

  {
    id: 'ha_gumi',
    title: 'Hausa Translation',
    author: 'Abubakar Mahmoud Gumi',
    category: 'global',
    language: 'Hausa',
    apiEdition: 'ha.gumi'
  },

  {
    id: 'hi_umari',
    title: 'Hindi Translation',
    author: 'Maulana Azizul Haque al-Umari',
    category: 'global',
    language: 'हिन्दी',
    apiEdition: 'hi.hindi'
  },

  {
    id: 'it_piccardo',
    title: 'Italian Translation',
    author: 'Hamza Roberto Piccardo',
    category: 'global',
    language: 'Italiano',
    apiEdition: 'it.piccardo'
  },

  {
    id: 'ja_mita',
    title: 'Japanese Translation',
    author: 'Ryoichi Mita',
    category: 'global',
    language: '日本語',
    apiEdition: 'ja.japanese'
  },

  {
    id: 'kk_altai',
    title: 'Kazakh Translation',
    author: 'Khalifah Altai',
    category: 'global',
    language: 'Қазақша'
  },

  {
    id: 'ko_choi',
    title: 'Korean Translation',
    author: 'Hamid Choi',
    category: 'global',
    language: '한국어',
    apiEdition: 'ko.korean'
  },

  {
    id: 'ml_parappoor',
    title: 'Malayalam Translation',
    author: 'Abdul Hameed and Kunhi Mohammed',
    category: 'global',
    language: 'മലയാളം',
    apiEdition: 'ml.abdulhameed'
  },

  {
    id: 'om_abaghuna',
    title: 'Oromo Translation',
    author: 'Ghaly Ababour Abaghuna',
    category: 'global',
    language: 'Oromoo'
  },

  {
    id: 'ps_abdulsalam',
    title: 'Pashto Translation',
    author: 'Abu Zakaria Abdulsalam',
    category: 'global',
    language: 'پښتو',
    apiEdition: 'ps.abdulsalam'
  },

  {
    id: 'pt_nasr',
    title: 'Portuguese Translation (Helmi Nasr)',
    author: 'Helmi Nasr',
    category: 'global',
    language: 'Português'
  },

  {
    id: 'so_abduh',
    title: 'Somali Translation',
    author: 'Mahmud Muhammad Abduh',
    category: 'global',
    language: 'Soomaali',
    apiEdition: 'so.abduh'
  },

  {
    id: 'sw_barwani',
    title: 'Swahili Translation',
    author: 'Ali Muhsin Al-Barwani',
    category: 'global',
    language: 'Kiswahili',
    apiEdition: 'sw.barwani'
  },

  {
    id: 'sv_bernstrom',
    title: 'Swedish Translation',
    author: 'Mohammed Knut Bernström',
    category: 'global',
    language: 'Svenska',
    apiEdition: 'sv.bernstrom'
  },

  {
    id: 'tg_rowwad',
    title: 'Tajik Translation',
    author: 'Dar ul Islam and Rowwad Translation Center',
    category: 'global',
    language: 'Тоҷикӣ'
  },

  {
    id: 'ta_baqav',
    title: 'Tamil Translation',
    author: 'AbdulHameed Baqav',
    category: 'global',
    language: 'தமிழ்'
  },

  {
    id: 'th_kingfahad',
    title: 'Thai Translation',
    author: 'King Fahad Quran Complex',
    category: 'global',
    language: 'ไทย',
    apiEdition: 'th.thai'
  },

  {
    id: 'ug_saleh',
    title: 'Uyghur Translation',
    author: 'Muhammad Saleh',
    category: 'global',
    language: 'ئۇيغۇرچە',
    apiEdition: 'ug.saleh'
  },

  {
    id: 'uz_mansour',
    title: 'Uzbek Translation (Alauddin Mansour)',
    author: 'Alauddin Mansour',
    category: 'global',
    language: 'Oʻzbekcha'
  },

  {
    id: 'uz_yusuf',
    title: 'Uzbek Translation (Muhammad Sodik)',
    author: 'Muhammad Sodik Muhammad Yusuf',
    category: 'global',
    language: 'Oʻzbekcha'
  },

  {
    id: 'vi_rowwad',
    title: 'Vietnamese Translation',
    author: 'Rowwad Translation Center',
    category: 'global',
    language: 'Tiếng Việt'
  },

  {
    id: 'dv_presidency',
    title: 'Divehi Translation',
    author: 'Office of the President of Maldives',
    category: 'global',
    language: 'Dhivehi'
  }
];
