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
  INTERJ: 'أداة تعجب',
  // Extend as needed to cover your dataset
};

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize: load corpus (qac.json) and verse text (quraan.txt)
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

    // 1) Exact form match on flat entries
    let matchedEntry =
      qacData.find(e => {
        const form = e?.form ?? e?.word ?? '';
        return form && normalizeArabic(form) === term;
      }) || null;

    // 2) Fallback: stem match
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

    // 3) Collect stem-family occurrences across flat dataset
    const occurrences = findStemFamilyOccurrences(matchedEntry, qacData) || [];

    // 4) Deduplicate by form+location, then lightly sort by sura:verse:word
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
    // Provided by loader after loadQuranText() warmed the cache
    return getVerseTextFromLoader(String(sura), String(verse)) || '';
  };

  const handleVerseClick = (sura, verse) => {
    setSelectedVerse({
      sura,
      verse,
      text: getVerseText(sura, verse)
    });
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
              <div key={idx} className="entry-card">
                <div className="arabic" dir="rtl" lang="ar">
                  {buckwalterToArabic(entry.form)}
                </div>
                <div className="details" dir="rtl" lang="ar">
                  <p><strong>الجذر:</strong> {buckwalterToArabic(entry.root)}</p>
                  <p><strong>اللفظة:</strong> {buckwalterToArabic(entry.lemma)}</p>
                  <p><strong>نوع الكلمة:</strong> {posMap[entry.tag] || entry.tag}</p>
                  <p
                    className="location"
                    onClick={() => handleVerseClick(entry.sura, entry.verse)}
                  >
                    سورة {entry.sura}، آية {entry.verse} (الكلمة {entry.wordNum})
                  </p>
                  {entry.segments?.prefixes?.length > 0 && (
                    <p>السوابق: {entry.segments.prefixes.map(buckwalterToArabic).join(' + ')}</p>
                  )}
                  <p>الجذر الصرفي: {buckwalterToArabic(entry.segments?.stem || '')}</p>
                  {entry.segments?.suffixes?.length > 0 && (
                    <p>اللواحق: {entry.segments.suffixes.map(buckwalterToArabic).join(' + ')}</p>
                  )}
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

      {selectedVerse && (
        <div className="verse-display">
          <h3 dir="rtl" lang="ar">سورة {selectedVerse.sura}، آية {selectedVerse.verse}</h3>
          <div className="verse-text" dir="rtl" lang="ar">
            {selectedVerse.text}
          </div>
        </div>
      )}
    </div>
  );
}
