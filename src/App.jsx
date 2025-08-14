import React, { useState, useEffect } from 'react';
import {
  loadQACData,
  loadQuranText,
  getVerseText as getVerseTextFromLoader,
  normalizeArabic,
  stemArabic,
  findStemFamilyOccurrences
} from './loader/qacJsonLoader';
import './styles.css';

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
        setError(`Data loading failed: ${err?.message || String(err)}`);
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
      <h1>Quranic Arabic Corpus Analyzer</h1>

      <div className="search-box">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter Arabic word"
          dir="rtl"
          lang="ar"
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {loading ? (
        <div className="status">Loading corpus data...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : results.length > 0 ? (
        <div className="results">
          <h2>Found {results.length} matches</h2>
          <div className="results-grid">
            {results.map((entry, idx) => (
              <div key={idx} className="entry-card">
                <div className="arabic">{entry.form}</div>
                <div className="details">
                  <p><strong>Root:</strong> {entry.root}</p>
                  <p><strong>Lemma:</strong> {entry.lemma}</p>
                  <p><strong>POS:</strong> {entry.tag}</p>
                  <p
                    className="location"
                    onClick={() => handleVerseClick(entry.sura, entry.verse)}
                  >
                    Sura {entry.sura}:{entry.verse} (word {entry.wordNum})
                  </p>
                  {entry.segments?.prefixes?.length > 0 && (
                    <p>Prefixes: {entry.segments.prefixes.join(' + ')}</p>
                  )}
                  <p>Stem: {entry.segments?.stem || ''}</p>
                  {entry.segments?.suffixes?.length > 0 && (
                    <p>Suffixes: {entry.segments.suffixes.join(' + ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="status">
          {searchTerm ? 'No matches found' : 'Enter a word to search'}
        </div>
      )}

      {selectedVerse && (
        <div className="verse-display">
          <h3>Sura {selectedVerse.sura}, Verse {selectedVerse.verse}</h3>
          <div className="verse-text" dir="rtl" lang="ar">
            {selectedVerse.text}
          </div>
        </div>
      )}
    </div>
  );
}
