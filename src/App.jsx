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
  return verseNorm.replace(
    pattern,
    (match) => `<span class="hl-stem">${match}</span>`
  );
}

// Coerce any loader payload into a flat array of records
function coerceQacArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidateKeys = [
    'data',
    'dataset',
    'entries',
    'tokens',
    'words',
    'qac',
    'items',
    'records'
  ];
  for (const k of candidateKeys) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

// Known affixes for fuzzy match
const knownPrefixes = [
  'و', 'ف', 'ب', 'ك', 'ل', 'س',
  'ال', 'وال', 'فال', 'بال', 'كال', 'ولل', 'فلل'
];
const knownSuffixes = [
  'ه', 'ها', 'هم', 'هن', 'كما', 'كم', 'كن',
  'نا', 'ني', 'وا', 'ات', 'ون', 'ين', 'ان'
];

function onlyAffixes(word, match) {
  const remainder = word.replace(match, '');
  if (!remainder) return true;
  return knownPrefixes.includes(remainder) || knownSuffixes.includes(remainder);
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
        const normalized = array.map((e) => ({
          ...e,
          segments: e?.segments ?? {
            prefixes: [],
            stem: e?.stem ?? '',
            suffixes: []
          }
        }));
        setQacData(normalized);
        window.__QAC_LEN__ = normalized.length;
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
    const stripped = stripPrefixes(raw);
    const term = normalizeArabicFromLoader(stripped);
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
      const inputStem = stemArabic(term);
      const directMatches = qacData.filter((e) => {
        const formNorm = normalizeArabicFromLoader(e?.form ?? e?.word ?? '');
        const stemVal = e?.segments?.stem ?? e?.stem ?? '';
        return formNorm === term || stemVal === inputStem;
      });
      occurrences = directMatches;
      // ---------- Fuzzy fallback ----------
      if (occurrences.length === 0) {
        const normTerm = term;
        const fuzzyHits = [];
        for (const entry of qacData) {
          const root = normalizeArabicFromLoader(
            buckwalterToArabic(entry.root || '')
          );
          const stem = normalizeArabicFromLoader(
            buckwalterToArabic(entry.segments?.stem || '')
          );
          for (const candidate of [root, stem]) {
            if (candidate.length < 3) continue;
            for (let i = 0; i <= candidate.length - 3; i++) {
              const trigram = candidate.slice(i, i + 3);
              if (
                normTerm.includes(trigram) &&
                onlyAffixes(normTerm, trigram)
              ) {
                fuzzyHits.push(entry);
                break;
              }
            }
          }
        }
        occurrences = fuzzyHits;
      }
    }

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
        <div className="status" dir="rtl" lang="ar">
          جارٍ تحميل بيانات المتن...
        </div>
      ) : error ? (
        <div className="error" dir="rtl" lang="ar">
          {error}
        </div>
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
                    <p>
                      <strong>الجذر:</strong>{' '}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightStemOrRoot(
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

     
