import React, { useState, useEffect } from 'react';
import {
  loadQACData,
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

  useEffect(() => {
    async function initialize() {
      try {
        const data = await loadQACData();
        setQacData(data || []);
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
    if (!raw) {
      setResults([]);
      return;
    }

    const term = normalizeArabic(raw);
    if (!term) {
      setResults([]);
      return;
    }

    let matchedToken = null;
    outer: for (const verseEntry of qacData) {
      const tokens = verseEntry?.tokens || [];
      for (const token of tokens) {
        const form = token?.form ?? token?.word ?? '';
        if (form && normalizeArabic(form) === term) {
          matchedToken = token;
          break outer;
        }
      }
    }

    if (!matchedToken) {
      const inputStem = stemArabic(term);
      outerStem: for (const verseEntry of qacData) {
        const tokens = verseEntry?.tokens || [];
        for (const token of tokens) {
          const tokenStem = token?.segments?.stem ?? token?.stem ?? null;
          if (tokenStem && tokenStem === inputStem) {
            matchedToken = token;
            break outerStem;
          }
        }
      }
    }

    if (!matchedToken) {
      setResults([]);
      return;
    }

    const occurrences = findStemFamilyOccurrences(matchedToken, qacData) || [];

    const unique = [];
    const seen = new Set();
    for (const entry of occurrences) {
      const key = `${entry.form}-${entry.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }

    setResults(unique.slice(0, 100));
  };

  const getVerseText = (sura, verse) => {
    const v =
      qacData.find(
        (e) =>
          (e.sura === sura || e.surah === sura) &&
          (e.verse === verse || e.ayah === verse)
      ) || null;

    return v?.verse || v?.text || v?.ayahText || '';
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
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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

// 🔹 CLOSE the export list cleanly — no trailing comma before a function export

// 🔹 Now declare the function cleanly at top level
export function findStemFamilyOccurrences(matchedToken, qacData) {
  if (!matchedToken || !matchedToken.segments?.stem) return [];

  const stem = matchedToken.segments.stem;
  const occurrences = [];

  qacData.forEach((entry, verseIndex) => {
    entry.tokens.forEach((token) => {
      if (token.segments?.stem === stem) {
        occurrences.push({
          verseIndex,
          token
        });
      }
    });
  });

  return occurrences;
}
