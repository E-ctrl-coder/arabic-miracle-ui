import React, { useState, useEffect } from 'react';
import {
  loadQACData,
  loadQuranText,
  getVerseText as getVerseTextFromLoader,
  normalizeArabic as normalizeArabicFromLoader,
  stemArabic,
  findStemFamilyOccurrences,
  stripPrefixes
} from './loader/qacJsonLoader';
import buckwalterToArabic from './utils/buckwalterToArabic';
import normalizeArabic from './utils/normalizeArabic';
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

function highlightStemOrRoot(text, entry) {
  if (!text || !entry) return text;
  const verseNorm = normalizeArabic(text);
  const stemNorm = normalizeArabic(buckwalterToArabic(entry?.segments?.stem || ''));
  const rootNorm = normalizeArabic(buckwalterToArabic(entry?.root || ''));
  if (!stemNorm && !rootNorm) return text;

  const parts = [];
  if (stemNorm) parts.push(stemNorm);
  if (rootNorm && rootNorm !== stemNorm) parts.push(rootNorm);

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    '(' + parts.map(escapeRegex).join('|') + ')' + '[\u064B-\u065F\u0670\u0640]*',
    'g'
  );

  return verseNorm.replace(pattern, (match) => `<span class="hl-stem">${match}</span>`);
}

// Coerce any loader payload into a flat array of records
function coerceQacArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidateKeys = ['data', 'dataset', 'entries', 'tokens', 'words', 'qac', 'items', 'records'];
  for (const k of candidateKeys) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
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
        const [data] = await Promise.all([loadQACData(), loadQuranText()]);
        const array = coerceQacArray(data);

        // Pre-normalize all entries for consistent search/display
        const normalized = array.map((e) => {
          const formArabic = buckwalterToArabic(e?.form ?? e?.word ?? '');
          const stemArabicStr = buckwalterToArabic(e?.segments?.stem ?? e?.stem ?? '');

          return {
            ...e,
            formArabic,
            normalizedForm: normalizeArabicFromLoader(stripPrefixes(formArabic)),
            segments: e?.segments ?? { prefixes: [], stem: stemArabicStr, suffixes: [] },
            normalizedStem: normalizeArabicFromLoader(stripPrefixes(stemArabicStr))
          };
        });

        setQacData(normalized);
        window.__QAC_LEN__ = normalized.length; // optional dev check
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

    const term = normalizeArabicFromLoader(stripPrefixes(raw));
    if (!term) {
      setResults([]);
      return;
    }

    // First try exact normalized form
    let matchedEntry = qacData.find((e) => e.normalizedForm === term) || null;

    // Then try normalized stem
    if (!matchedEntry) {
      matchedEntry = qacData.find((e) => e.normalizedStem === term) || null;
    }

    let occurrences = [];
    if (matchedEntry) {
      occurrences = findStemFamilyOccurrences(matchedEntry, qacData) || [];
      if (matchedEntry.tag === 'V' && matchedEntry.root) {
        const sameRootVerbs = qacData.filter(
          (e) => e.tag === 'V' && e.root === matchedEntry.root
        );
        occurrences = occurrences.concat(sameRootVerbs);
      }
    } else {
      // Fallback: scan both normalizedForm and normalizedStem
      const directMatches = qacData.filter(
        (e) => e.normalizedForm === term || e.normalizedStem === term
      );
      occurrences = directMatches;
    }

    // Deduplicate and sort
    const seen = new Set();
    const unique = [];
    for (const entry of occurrences) {
      const key = `${entry.form}-${entry.location ?? `${entry.sura}:${entry.verse}:${entry.wordNum}`}`;
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
          id="qac-term"
          name="qac-term"
        />
        <button onClick={handleSearch}>ابحث</button>
      </div>

      {loading ? (
        <div className="status" dir="rtl" lang="ar"> جارٍ تحميل بيانات المتن... </div>
      ) : error ? (
        <div className="error" dir="rtl" lang="ar">{error}</div>
      ) : results.length > 0 ? (
        <div className="results">
          <h2 dir="rtl" lang="ar">تم العثور على {results.length} نتيجة</h2>
          <div className="results-grid">
            {results.map((entry, idx) => {
              const isOpen = openReference &&
                openReference.sura === entry.sura &&
                openReference.verse === entry.verse;
              const verseHTML = isOpen
                ? highlightStemOrRoot(openReference.text, entry)
                : null;
              return (
                <div key={idx} className="entry-card">
                  <div className="token-display">
                    {entry?.segments?.prefixes?.length > 0 && (
                      <span className="prefix">
                        {entry.segments.prefixes.map(buckwalterToArabic).join('')}
                      </span>
                    )}
                    <span className="hl-stem">
                      {buckwalterToArabic(entry?.segments?.stem || '')}
                    </span>
                    {entry?.segments?.suffixes?.length > 0 && (
                      <span className="suffix">
                        {entry.segments.suffixes.map(buckwalterToArabic).join('')}
                      </span>
                    )}
                  </div>

                  <div className="arabic" dir="rtl" lang="ar"
                    dangerouslySetInnerHTML={{
                      __html: highlightStemOrRoot(buckwalterToArabic(entry.form), entry)
                    }} />

                  <div className="details" dir="rtl" lang="ar">
                    <p>
                      <strong>الجذر:</strong>{' '}
                      <span
                        dangerouslySetInnerHTML={{
                          __html:highlightStemOrRoot(
                            buckwalterToArabic(entry.root || ''),
                            entry
                          )
                        }}
                      />
                    </p>
                    <p>
                      <strong>اللفظة:</strong>{' '}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightStemOrRoot(
                            buckwalterToArabic(entry.lemma || ''),
                            entry
                          )
                        }}
                      />
                    </p>
                    <p>
                      <strong>نوع الكلمة:</strong> {posMap[entry.tag] || entry.tag}
                    </p>

                    <p
                      className="location"
                      style={{ color: 'blue', cursor: 'pointer' }}
                      onClick={() => handleVerseClick(entry.sura, entry.verse)}
                    >
                      سورة {entry.sura}، آية {entry.verse} (الكلمة {entry.wordNum})
                    </p>

                    {entry?.segments?.prefixes?.length > 0 && (
                      <p>
                        السوابق:{' '}
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightStemOrRoot(
                              entry.segments.prefixes.map(buckwalterToArabic).join(' + '),
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
                            buckwalterToArabic(entry?.segments?.stem || ''),
                            entry
                          )
                        }}
                      />
                    </p>

                    {entry?.segments?.suffixes?.length > 0 && (
                      <p>
                        اللواحق:{' '}
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightStemOrRoot(
                              entry.segments.suffixes.map(buckwalterToArabic).join(' + '),
                              entry
                            )
                          }}
                        />
                      </p>
                    )}
                  </div>

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
