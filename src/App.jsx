import React, { useState, useEffect } from 'react';
import { 
  loadQACData,
  normalizeArabic,
  stemArabic,
  findRootForWord,
  detectPattern,
  classifyWord,
  loadQuranText,
  getVerseText
} from './loader/qacJsonLoader';
import './styles.css';

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [derivatives, setDerivatives] = useState([]);
  const [selectedVerse, setSelectedVerse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [data] = await Promise.all([
          loadQACData(),
          loadQuranText()
        ]);
        setQacData(data);
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, []);

  const handleAnalyze = () => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setAnalysis(null);
      setDerivatives([]);
      return;
    }

    // Step 1: Analyze the input word
    const wordAnalysis = {
      input: searchTerm,
      normalized: normalizeArabic(searchTerm),
      stem: stemArabic(searchTerm),
      root: findRootForWord(searchTerm, qacData),
      pattern: detectPattern(searchTerm),
      type: classifyWord(searchTerm)
    };
    setAnalysis(wordAnalysis);

    // Step 2: Find all Quranic derivatives
    const rootDerivatives = qacData
      .filter(entry => normalizeArabic(entry.root) === wordAnalysis.root)
      .sort((a, b) => {
        const [aSura, aVerse] = a.location.split(':').map(Number);
        const [bSura, bVerse] = b.location.split(':').map(Number);
        return aSura - bSura || aVerse - bVerse;
      });
    setDerivatives(rootDerivatives);
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
          onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder="Enter Arabic word"
          dir="rtl"
          lang="ar"
        />
        <button onClick={handleAnalyze}>Analyze</button>
      </div>

      {loading ? (
        <div>Loading data...</div>
      ) : (
        <>
          {analysis && (
            <div className="analysis-results">
              <h2>Word Analysis</h2>
              <div className="analysis-grid">
                <div><strong>Input:</strong> <span className="arabic">{analysis.input}</span></div>
                <div><strong>Normalized:</strong> <span className="arabic">{analysis.normalized}</span></div>
                <div><strong>Stem:</strong> <span className="arabic">{analysis.stem}</span></div>
                <div><strong>Root:</strong> {analysis.root}</div>
                <div><strong>Pattern:</strong> {analysis.pattern}</div>
                <div><strong>Type:</strong> {analysis.type}</div>
              </div>
            </div>
          )}

          {derivatives.length > 0 && (
            <div className="derivatives-results">
              <h3>Quranic Occurrences ({derivatives.length})</h3>
              <div className="derivatives-list">
                {derivatives.map((entry, idx) => (
                  <div key={`${entry.location}-${idx}`} className="derivative-item">
                    <span className="arabic">{entry.form}</span>
                    <span 
                      className="verse-link"
                      onClick={() => handleVerseClick(entry.sura, entry.verse)}
                    >
                      {entry.sura}:{entry.verse}
                    </span>
                    {entry.tag && <span className="pos-tag">{entry.tag}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!analysis && searchTerm && (
            <div className="no-results">No analysis available for this word</div>
          )}
        </>
      )}

      {selectedVerse && (
        <div className="verse-modal">
          <div className="verse-content">
            <h3>Sura {selectedVerse.sura}, Verse {selectedVerse.verse}</h3>
            <div className="arabic-verse" dir="rtl" lang="ar">
              {selectedVerse.text}
            </div>
            <button onClick={() => setSelectedVerse(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
