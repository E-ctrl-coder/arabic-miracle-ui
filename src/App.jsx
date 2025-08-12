import React, { useState, useEffect, useMemo } from 'react';
import { loadQACData, normalizeArabic, loadQuranText, getVerseText } from './loader/qacJsonLoader';
import './styles.css';

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoized valid affixes (normalized once)
  const validAffixes = useMemo(() => [
    // Single-letter prefixes
    'و', 'ف', 'ب', 'ك', 'ل', 'س', 'ا',
    // Compound prefixes
    'ال', 'وال', 'بال', 'فال', 'كال', 'ولل',
    // Suffixes
    'ه', 'ها', 'هم', 'هن', 'ي', 'ك', 'نا', 'ان', 'ون', 'ين'
  ].map(normalizeArabic), []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [data, _] = await Promise.all([
          loadQACData(),
          loadQuranText()
        ]);
        setQacData(data);
      } catch (err) {
        setError(`Data loading failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, []);

  const isValidAffix = (text) => {
    if (!text) return true; // No affix is valid
    return validAffixes.some(affix => 
      text.includes(affix) || affix.includes(text)
    );
  };

  const handleSearch = () => {
    const normalizedInput = normalizeArabic(searchTerm.trim());
    
    // Early returns for invalid cases
    if (!normalizedInput || normalizedInput.length < 2) {
      setResults([]);
      return;
    }

    // 1. Exact match search
    const exactMatches = qacData.filter(entry => 
      normalizeArabic(entry.form) === normalizedInput
    );

    if (exactMatches.length > 0) {
      setResults(exactMatches);
      return;
    }

    // 2. Stem/Root search with affix validation
    const validMatches = qacData.filter(entry => {
      const normalizedStem = normalizeArabic(entry.stem);
      const normalizedRoot = normalizeArabic(entry.root);
      
      // Find which part matches (prioritize stem over root)
      const matchedPart = normalizedInput.includes(normalizedStem) 
        ? normalizedStem 
        : normalizedInput.includes(normalizedRoot) 
          ? normalizedRoot 
          : null;

      if (!matchedPart) return false;
      
      // Extract affixes
      const matchIndex = normalizedInput.indexOf(matchedPart);
      const prefix = normalizedInput.substring(0, matchIndex);
      const suffix = normalizedInput.substring(matchIndex + matchedPart.length);
      
      return isValidAffix(prefix) && isValidAffix(suffix);
    });

    setResults(validMatches);
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
              <div key={`${entry.location}-${idx}`} className="entry-card">
                <div className="arabic">{entry.form}</div>
                <div className="details">
                  <p><strong>Root:</strong> {entry.root || 'N/A'}</p>
                  <p><strong>Lemma:</strong> {entry.lemma || 'N/A'}</p>
                  <p><strong>POS:</strong> {entry.tag || 'N/A'}</p>
                  <p className="location" onClick={() => handleVerseClick(entry.sura, entry.verse)}>
                    Sura {entry.sura}:{entry.verse} (word {entry.wordNum})
                  </p>
                  {entry.segments?.prefixes?.length > 0 && (
                    <p>Prefixes: {entry.segments.prefixes.join(' + ')}</p>
                  )}
                  <p>Stem: {entry.segments?.stem || 'N/A'}</p>
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
