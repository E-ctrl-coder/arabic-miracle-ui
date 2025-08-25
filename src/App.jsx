import React, { useState, useEffect } from 'react';
import {
  loadQACData,
  loadQuranText,
  getVerseText as getVerseTextFromLoader,
  normalizeArabic as normalizeArabicFromLoader
} from './loader/qacJsonLoader';
import buckwalterToArabic from './utils/buckwalterToArabic';
import normalizeArabic from './utils/normalizeArabic';
import './styles.css';

const posMap = {
  V: 'فعل', N: 'اسم', PN: 'اسم علم', ADJ: 'صفة', ADV: 'حال',
  PRON: 'ضمير', P: 'حرف جر', NUM: 'عدد', CONJ: 'حرف عطف', PART: 'حرف',
  DET: 'أداة تعريف', PREP: 'حرف جر', INTERJ: 'أداة تعجب',
};

// ---------------- Highlight helper ----------------
function highlightStemOrRoot(text, entry) {
  if (!text || !entry) return text;
  const verseNorm = normalizeArabic(text);
  const stemNorm = normalizeArabic(
    buckwalterToArabic(entry?.segments?.stem || '')
  );
  const rootNorm = normalizeArabic(
    buckwalterToArabic(entry?.root || '')
  );
  if (!stemNorm && !rootNorm) return text;

  const parts = [];
  if (rootNorm) parts.push(rootNorm);
if (stemNorm && stemNorm !== rootNorm) parts.push(stemNorm);

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    '(' + parts.map(escapeRegex).join('|') + ')' +
      '[\\u064B-\\u065F\\u0670\\u0640]*',
    'g'
  );

  return verseNorm.replace(
    pattern,
    (match) => `<span class="hl-stem">${match}</span>`
  );
}

// ---------------- Data coercion ----------------
function coerceQacArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidateKeys = [
    'data', 'dataset', 'entries', 'tokens',
    'words', 'qac', 'items', 'records'
  ];
  for (const k of candidateKeys) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

// ---------------- Known affixes ----------------
const knownPrefixes = [
  'و','ف','ب','ك','ل','س','ال','وال','فال','بال','كال','ولل','فلل'
];
const knownSuffixes = [
  'ه','ها','هم','هن','كما','كم','كن','نا','ني',
  'وا','ات','ون','ين','ان'
];

// ---------------- Matching helpers ----------------
function trigramAffixMatch(term, candidate) {
  if (!term || !candidate || candidate.length < 3) return false;
  for (let i = 0; i <= candidate.length - 3; i++) {
    const trigram = candidate.slice(i, i + 3);
    if (term.includes(trigram) && affixOnlyRemainder(term, trigram)) {
      return true;
    }
  }
  return false;
}

function affixOnlyRemainder(word, match) {
  let remainder = word.replace(match, '');
  let peeled = true;
  while (peeled && remainder.length) {
    peeled = false;
    for (const pre of knownPrefixes.sort((a,b)=>b.length-a.length)) {
      if (remainder.startsWith(pre)) {
        remainder = remainder.slice(pre.length);
        peeled = true;
        break;
      }
    }
    for (const suf of knownSuffixes.sort((a,b)=>b.length-a.length)) {
      if (remainder.endsWith(suf)) {
        remainder = remainder.slice(0, -suf.length);
        peeled = true;
        break;
      }
    }
  }
  return remainder.length === 0;
}

function nearRootMatch(term, root) {
  const tSimple = term.replace(/[اوي]/g, '');
  const rSimple = root.replace(/[اوي]/g, '');
  return trigramAffixMatch(tSimple, rSimple);
}

// ---------------- Main App ----------------
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
        const array = coerceQacArray(data);
        const normalized = array.map((e) => {
          const formArabic = buckwalterToArabic(e?.form ?? e?.word ?? '');
          const stemArabicStr = buckwalterToArabic(e?.segments?.stem ?? e?.stem ?? '');
          const rootArabicStr = buckwalterToArabic(e?.root ?? '');
          return {
            ...e,
            formArabic,
            normForm: normalizeArabicFromLoader(formArabic),
            normStem: normalizeArabicFromLoader(stemArabicStr),
            normRoot: normalizeArabicFromLoader(rootArabicStr),
            segments: e?.segments ?? {
              prefixes: [], stem: e?.stem ?? '', suffixes: []
            }
          };
        });
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

  const termArabic = normalizeArabicFromLoader(buckwalterToArabic(raw));
  if (!termArabic) {
    setResults([]);
    return;
  }

  let matchedEntry = null;
  let occurrences = [];

  // ---------------- Priority 1: Dual-root match ----------------
  matchedEntry = qacData.find(e =>
    e.normRoot &&
    e.normStem &&
    e.normRoot === e.normStem &&
    e.normRoot === termArabic
  );

  // ---------------- Priority 2: Segmentation root match ----------------
  if (!matchedEntry) {
    matchedEntry = qacData.find(e => e.normStem === termArabic);
  }

  // ---------------- Priority 3: Fuzzy form match ----------------
  if (!matchedEntry) {
    matchedEntry = qacData.find(e => trigramAffixMatch(termArabic, e.normForm));
  }

  // ---------------- Expansion to all derivatives ----------------
  if (matchedEntry) {
    const anchorRoot = matchedEntry.normRoot || matchedEntry.normStem || termArabic;
    occurrences = qacData.filter(e =>
      e.normRoot === anchorRoot ||
      e.normStem === anchorRoot
    );
  }

  // ---------------- Deduplicate & sort ----------------
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
    const sa = Number(a.sura) || 0;
    const sb = Number(b.sura) || 0;
    if (sa !== sb) return sa - sb;
    const va = Number(a.verse) || 0;
    const vb = Number(b.verse) || 0;
    if (va !== vb) return va - vb;
    const wa = Number(a.wordNum) || 0;
    const wb = Number(b.wordNum) || 0;
    if (wa !== wb) return wa - wb;
    return String(a.form || '').localeCompare(String(b.form || ''));
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
}
