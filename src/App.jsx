import React, { useState, useEffect } from 'react';
import {
  loadQACData,
  loadQuranText,
  getVerseText as getVerseTextFromLoader,
  normalizeArabic,
  stemArabic,
  findStemFamilyOccurrences
} from './loader/qacJsonLoader';
import buckwalterToArabic from './utils/buckwalterToArabic';
import './styles.css';

const posMap = {
  V: 'فعل',
  N: 'اسم',
  PN: 'اسم علم',
  ADJ: 'صفة',
  ADV: 'حال',
  PRON: 'ضمير',
  P: 'حرف جر',
  NUM: 'عدد',
  CONJ: 'حرف عطف',
  PART: 'حرف',
  DET: 'أداة تعريف',
  PREP: 'حرف جر',
  INTERJ: 'أداة تعجب'
};

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initialize() {
      try {
        const [data] = await Promise.all([
          loadQACData(),
          loadQuranText()
        ]);
        setQacData(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(`فشل تحميل البيانات: ${err?.message || String(err)}`);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, []);

  const handleSearch = () => {
    const raw = searchTerm.trim();
    if (!raw || loading) {
      setResults([]);
      return;
    }
    const term = normalizeArabic(raw);
    if (!term) {
      setResults([]);
      return;
    }

    let matchedEntry =
      qacData.find(e => {
        const form = e?.form ?? e?.word ?? '';
        return form && normalizeArabic(form) === term;
      }) || null;

    if (!matchedEntry) {
      const inputStem = stemArabic(term);
      matchedEntry = qacData.find(e => {
        const tokenStem = e?.segments?.stem ?? e?.stem ?? null;
        return tokenStem && tokenStem === inputStem;
      }) || null;
    }

    if (!matchedEntry) {
      setResults([]);
      return;
    }

    const occurrences = findStemFamilyOccurrences(matchedEntry, qacData) || [];

    const seen = new Set();
    const unique = [];
    for (const entry of occurrences) {
      const key = `${entry.form}-${entry.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }

    unique.sort((a, b) => {
      const sa = Number(a.sura), sb = Number(b.sura);
      if (sa !== sb) return sa - sb;
      const va = Number(a.verse), vb = Number(b.verse);
      if (va !== vb) return va - vb;
      const wa = Number(a.wordNum), wb = Number(b.wordNum);
      return wa - wb;
    });

    setResults(unique.slice(0, 100));
  };

  const getVerseText = (sura, verse) => {
    return getVerseTextFromLoader(String(sura), String(verse)) || '';
  };

  return (
    <div className="app">
      <h1>المحلل الصرفي للقرآن الكريم</h1>

      <div className="search-box">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="أدخل كلمة عربية"
          dir="rtl"
          lang="ar"
        />
        <button onClick={handleSearch}>ابحث</button>
      </div>

      {loading ? (
        <div className="status" dir="rtl" lang="ar">جارٍ تحميل بيانات المتن...</div>
      ) : error ? (
        <div className="error" dir="rtl" lang="ar">{error}</div>
      ) : results.length > 0 ? (
        <div className="results">
          <h2 dir="rtl" lang="ar">تم العثور على {results.length} نتيجة</h2>
          <div className="results-grid">
            {results.map((entry, idx) => (
              <div key={idx} className="result-row">
                <a
                  className="verse-ref"
                  href={`#surah${entry.sura}-ayah${entry.verse}`}
                >
                  سورة {entry.sura}، آية {entry.verse} (الكلمة {entry.wordNum})
                </a>
                <div className="verse-text">
                  {getVerseText(entry.sura, entry.verse)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="status" dir="rtl" lang="ar">
          {searchTerm ? 'لم يتم العثور على نتائج' : 'أدخل كلمة للبحث'}
        </div>
      )}
    </div>
  );
}
