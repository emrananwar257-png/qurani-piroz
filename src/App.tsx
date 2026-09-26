import React, { useState, useEffect } from 'react';

import { SURAHS_INDEX } from './data/surahsData';
import { SurahListView } from './components/SurahListView';
import { MushafPageView } from './components/MushafPageView';
import { QuranReader } from './components/QuranReader/QuranReader';

type ReaderMode = 'old' | 'new';

export default function App() {
const [view, setView] = useState<'index' | 'mushaf'>(() => {
try {
const saved = localStorage.getItem('quran_last_view');
return saved === 'mushaf' ? 'mushaf' : 'index';
} catch {
return 'index';
}
});

const [currentPage, setCurrentPage] = useState<number>(() => {
try {
const saved = localStorage.getItem('quran_last_page');
const n = saved ? parseInt(saved, 10) : 1;

  return n >= 1 && n <= 604 ? n : 1;
} catch {
  return 1;
}

});

/*

* Reader mode

* 

* old = MushafPageView ـی کۆن

* new = QuranReader ـی نوێ

* 

* بۆ ئێستا نوێکە چالاکە.

* ئەگەر هەر کێشەیەک هەبوو دەتوانین بە ئاسانی بیکەینە old.
  */
  const [readerMode, setReaderMode] = useState<ReaderMode>(() => {
  try {
  const saved = localStorage.getItem('quran_reader_mode');
  
  return saved === 'old' ? 'old' : 'new';
  } catch {
  return 'new';
  }
  });

useEffect(() => {
try {
localStorage.setItem('quran_last_view', view);
} catch {}
}, [view]);

useEffect(() => {
try {
localStorage.setItem(
'quran_last_page',
String(currentPage)
);
} catch {}
}, [currentPage]);

useEffect(() => {
try {
localStorage.setItem(
'quran_reader_mode',
readerMode
);
} catch {}
}, [readerMode]);

/*

* پاراستنی شوێنی Scroll ـی لیستی سورەتەکان
  */
  useEffect(() => {
  if (view !== 'index') return;

const raf = requestAnimationFrame(() => {
  try {
    const saved =
      sessionStorage.getItem(
        'quran_index_scroll'
      );

    if (saved) {
      window.scrollTo({
        top: parseInt(saved, 10),
        behavior: 'auto'
      });
    }
  } catch {}
});

let saveTimer:
  | ReturnType<typeof setTimeout>
  | null = null;

const handleScroll = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    try {
      sessionStorage.setItem(
        'quran_index_scroll',
        String(window.scrollY)
      );
    } catch {}
  }, 150);
};

window.addEventListener(
  'scroll',
  handleScroll,
  { passive: true }
);

return () => {
  cancelAnimationFrame(raf);

  window.removeEventListener(
    'scroll',
    handleScroll
  );

  if (saveTimer) {
    clearTimeout(saveTimer);
  }
};

}, [view]);

/*

* کردنەوەی سورەت لە Index
  */
  const openSurahPage = (page: number) => {
  setCurrentPage(page);
  setView('mushaf');
  };

/*

* لاپەڕەی داهاتوو
  */
  const handleNextPage = () => {
  setCurrentPage(page => {
  if (page >= 604) {
  return 604;
  }
  
  return page + 1;
  });
  };

/*

* لاپەڕەی پێشوو
  */
  const handlePrevPage = () => {
  setCurrentPage(page => {
  if (page <= 1) {
  return 1;
  }
  
  return page - 1;
  });
  };

/*

* گۆڕینی Reader
* 
* ئەمە بۆ ئێستا UI ـی تایبەتی نییە.
* تەنها App هەردوو component ـەکەی دەناسێت.
  */
  const switchReader = (mode: ReaderMode) => {
  setReaderMode(mode);
  };

return (
<div
className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-200"
dir="rtl"
>
{view === 'index' && (
<SurahListView
surahs={SURAHS_INDEX}
onOpenSurah={openSurahPage}
onOpenSettings={() => {}}
bgStyle="white"
appLang="ku"
accentColor="gold"
showKurdishNames={true}
showNumbers={true}
/>
)}

  {view === 'mushaf' && (
    <>
      {/*
       * ============================================
       * READER ـی کۆن
       * ============================================
       *
       * ئەمە بە تەواوی هەڵگیراوە.
       * هیچ functionality ـی کۆن لەناو نەچووە.
       */}
      {readerMode === 'old' && (
        <MushafPageView
          currentPage={currentPage}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          onBackToIndex={() =>
            setView('index')
          }
          bgStyle="white"
          appLang="ku"
          showNumbers={true}
          surahsList={SURAHS_INDEX}
          onJumpToPage={(page) =>
            setCurrentPage(page)
          }
        />
      )}

      {/*
       * ============================================
       * READER ـی نوێ
       * ============================================
       *
       * ئەمە QuranReader ـە.
       *
       * هەمان currentPage
       * هەمان navigation
       * هەمان Surah index
       *
       * بەڵام audio + ayah highlight
       * لە component ـی نوێدا بەڕێوەدەبرێت.
       */}
      {readerMode === 'new' && (
        <QuranReader
          currentPage={currentPage}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
          onBackToIndex={() =>
            setView('index')
          }
          bgStyle={{
            background: 'white'
          }}
          appLang="ku"
          showNumbers={true}
          surahsList={SURAHS_INDEX}
          onJumpToPage={(page) =>
            setCurrentPage(page)
          }
        />
      )}

      {/*
       * ============================================
       * TEMPORARY DEVELOPMENT SWITCH
       * ============================================
       *
       * ئەم دوگمەیە تەنها بۆ تاقیکردنەوەیە.
       *
       * دەتوانین دواتر لایببەین و بیکەینە
       * Settings ـی جوانتر.
       */}
      <button
        type="button"
        onClick={() =>
          switchReader(
            readerMode === 'new'
              ? 'old'
              : 'new'
          )
        }
        style={{
          position: 'fixed',
          bottom: 115,
          left: 12,
          zIndex: 9999,
          border: 'none',
          borderRadius: 12,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.72)',
          color: '#fff',
          fontSize: 12,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)'
        }}
      >
        {readerMode === 'new'
          ? 'Reader: نوێ'
          : 'Reader: کۆن'}
      </button>
    </>
  )}
</div>

);
}
