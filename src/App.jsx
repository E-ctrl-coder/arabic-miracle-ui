import React, { useState, useEffect } from 'react';
import { loadQACData, normalizeArabic, stemArabic, loadQuranText, getVerseText } from './loader/qacJsonLoader';
import './styles.css';

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load both datasets in parallel
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

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const normalized = normalizeArabic(searchTerm);
    if (!normalized) {
      setResults([]);
      return;
    }

    // Exact match search
    let matches = qacData.filter(entry => 
      entry.normalizedForm === normalized
    );

    // Stem match fallback
    if (matches.length === 0) {
      const stem = stemArabic(normalized);
      matches = qacData.filter(entry => 
        entry.stem === stem && stem.length > 2
      );
    }

    // Remove duplicates
    const uniqueResults = [];
    const seen = new Set();
    
    matches.forEach(entry => {
      const key = `${entry.form}-${entry.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(entry);
      }
    });

    setResults(uniqueResults.slice(0, 100));
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
                  <p className="location" onClick={() => handleVerseClick(entry.sura, entry.verse)}>
                    Sura {entry.sura}:{entry.verse} (word {entry.wordNum})
                  </p>
                  {entry.segments.prefixes.length > 0 && (
                    <p>Prefixes: {entry.segments.prefixes.join(' + ')}</p>
                  )}
                  <p>Stem: {entry.segments.stem}</p>
                  {entry.segments.suffixes.length > 0 && (
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
