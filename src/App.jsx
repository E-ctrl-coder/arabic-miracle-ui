import React, { useState, useEffect } from 'react';
import { loadQACData, normalizeArabic, stemArabic, analyzeEntry } from './loader/qacJsonLoader';
import './styles.css';

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const data = await loadQACData();
        setQacData(data);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load dictionary data");
        setIsLoading(false);
        console.error(err);
      }
    };
    initialize();
  }, []);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    // Clean and normalize input
    const cleanInput = searchTerm.replace(/[^\p{Script=Arabic}\s]/gu, '');
    const normTerm = normalizeArabic(cleanInput);
    
    if (normTerm.length < 1) {
      setResults([]);
      return;
    }

    // Exact match search
    let matches = qacData.filter(entry => 
      entry.normalizedForm === normTerm
    );

    // Stem match fallback
    if (matches.length === 0) {
      const inputStem = stemArabic(normTerm);
      matches = qacData.filter(entry => 
        entry.stem === inputStem && inputStem.length > 2
      );
    }

    // Remove duplicates and limit results
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

  return (
    <div className="app-container">
      <header>
        <h1>Arabic Morphological Analyzer</h1>
        <div className="search-box">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="أدخل كلمة"
            dir="rtl"
            lang="ar"
          />
          <button onClick={handleSearch}>بحث</button>
        </div>
      </header>

      <main>
        {isLoading ? (
          <div className="loading">Loading dictionary...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : results.length > 0 ? (
          <section className="results-section">
            <h2>Analysis Results ({results.length})</h2>
            <div className="results-grid">
              {results.map((entry, index) => {
                const analysis = analyzeEntry(entry);
                return (
                  <div key={`${analysis.location}-${index}`} className="analysis-card">
                    <div className="arabic-word">{analysis.form}</div>
                    <div className="morphological-data">
                      <div><strong>Root:</strong> {analysis.root}</div>
                      <div><strong>Lemma:</strong> {analysis.lemma}</div>
                      <div><strong>POS:</strong> {analysis.tag}</div>
                      <div className="location">Location: {analysis.location}</div>
                    </div>
                    <div className="segments">
                      {analysis.prefixes.length > 0 && (
                        <div>Prefixes: {analysis.prefixes.join(' + ')}</div>
                      )}
                      {analysis.suffixes.length > 0 && (
                        <div>Suffixes: {analysis.suffixes.join(' + ')}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="no-results">
            {searchTerm ? 'No results found' : 'Enter a word to begin analysis'}
          </div>
        )}
      </main>
    </div>
  );
}
