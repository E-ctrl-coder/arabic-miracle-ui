import React, { useState, useEffect } from 'react';
import {
  loadQACData,
  loadQuranText,
  getVerseText as getVerseTextFromLoader,
  normalizeArabic as normalizeArabicFromLoader, // keep original loader fn name separate
  stemArabic,
  findStemFamilyOccurrences
} from './loader/qacJsonLoader';
import buckwalterToArabic from './utils/buckwalterToArabic';
import normalizeArabic from './utils/normalizeArabic'; // ← NEW import for our stricter matcher
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
};

// Updated: normalize both verse text and patterns
function highlightStemOrRoot(text, entry) {
  if (!text || !entry) return text;

  // Normalise the verse text
  const verseNorm = normalizeArabic(text);

  // Convert and normalise stem/root from entry
  const stemNorm = normalizeArabic(
    buckwalterToArabic(entry.segments?.stem || '')
  );
  const rootNorm = normalizeArabic(
    buckwalterToArabic(entry.root || '')
  );

  if (!stemNorm && !rootNorm) return text;

  const parts = [];
  if (stemNorm) parts.push(stemNorm);
  if (rootNorm && rootNorm !== stemNorm) parts.push(rootNorm);

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    '(' + parts.map(escapeRegex).join('|') + ')' + '[\u064B-\u065F\u0670\u0640]*',
    'g'
  );

  // Apply highlighting to the normalised verse text, but preserve matched chars from original
  let i = 0;
  return verseNorm.replace(pattern, (match) => {
    return `<span class="hl-stem">${match}</span>`;
  });
}

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [openReference, setOpenReference] = useState(null);
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

    const term = normalizeArabicFromLoader(raw);
    if (!term) {
      setResults([]);
      return;
    }

    let matchedEntry =
      qacData.find((e) => {
        const form = e?.form ?? e?.word ?? '';
        return form && normalizeArabicFromLoader(form) === term;
      }) || null;

    if (!matchedEntry) {
      const inputStem = stemArabic(term);
      matchedEntry = qacData.find((e) => {
        const tokenStem = e?.segments?.stem ?? e?.stem ?? null;
        return tokenStem && tokenStem === inputStem;
      }) || null;
    }

    if (!matchedEntry) {
      setResults([]);
      return;
    }

    const occurrences = findStemFamilyOccurrences(matchedEntry, qacData) || [];
    let expandedOccurrences = [...occurrences];

    if (matchedEntry.tag === 'V' && matchedEntry.root) {
      const sameRootVerbs = qacData.filter(
        (e) => e.tag === 'V' && e.root === matchedEntry.root
      );
      expandedOccurrences = expandedOccurrences.concat(sameRootVerbs);
    }

    const seen = new Set();
    const unique = [];
    for (const entry of expandedOccurrences) {
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

    setResults(unique);
    setOpenReference(null);
  };

  const handleVerseClick = (sura, verse) => {
    if (openReference && openReference.sura === sura && openReference.verse === verse) {
      setOpenReference(null);
      return;
    }
    setOpenReference({
      sura,
      verse,
      text: getVerseTextFromLoader(String(sura), String(verse)) || ''
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
            {results.map((entry, idx) => {
              const isOpen =
                openReference &&
                openReference.sura === entry.sura &&
                openReference.verse === entry.verse;

              const verseHTML = isOpen
                ? highlightStemOrRoot(openReference.text, entry)
                : null;

              return (
                <div key={idx} className="entry-card">
                  <div
                    className="arabic"
                    dir="rtl"
                    lang="ar"
                    dangerouslySetInnerHTML={{
                      __html: highlightStemOrRoot(
                        buckwalterToArabic(entry.form),
                        entry
                      )
                    }}
                  />

                  <div className="details" dir="rtl" lang="ar">
                    <p><strong>الجذر:</strong>{' '}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightStemOrRoot(
                            buckwalterToArabic(entry.root || ''),
                            entry
                          )
                        }}
                      />
                    </p>

                    <p><strong>اللفظة:</strong>{' '}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightStemOrRoot(
                            buckwalterToArabic(entry.lemma || ''),
                            entry
                          )
                        }}
                      />
                    </p>

                    <p><strong>نوع الكلمة:</strong> {posMap[entry.tag] || entry.tag}</p>

                    <p
                      className="location"
                      style={{ color: 'blue', cursor: 'pointer' }}
                      onClick={() => handleVerseClick(entry.sura, entry.verse)}
                    >
                      سورة {entry.sura}، آية {entry.verse} (الكلمة {entry.wordNum})
                    </p>

                    {entry.segments?.prefixes?.length > 0 && (
                      <p>
                        السوابق:{' '}
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightStemOrRoot(
                              entry.segments.prefixes
                                .map(buckwalterToArabic)
                                .join(' + '),
                              entry
                            )
                          }}
                        />
                      </p>
                    )}

                    <p>
                      الجذر الصرفي:{' '}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightStemOrRoot(
                            buckwalterToArabic(entry.segments?.stem || ''),
                            entry
                          )
                        }}
                      />
                    </p>

                    {/* Suffixes */}
                    {entry.segments?.suffixes?.length > 0 && (
                      <p>
                        اللواحق:{' '}
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightStemOrRoot(
                              entry.segments.suffixes
                                .map(buckwalterToArabic)
                                .join(' + '),
                              entry
                            )
                          }}
                        />
                      </p>
                    )}
                  </div>

                  {/* Expanded verse with highlights */}
                  {isOpen && verseHTML && (
                    <div
                      className="verse-text"
                      dir="rtl"
                      lang="ar"
                      dangerouslySetInnerHTML={{ __html: verseHTML }}
                    />
                  )}
                </div>
              );
            })}
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
