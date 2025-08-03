// src/App.jsx

import React, { useState, useEffect } from 'react';
import { getMatches } from './utils/dataLoader';
import './index.css';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults]       = useState(null);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const word = inputValue.trim();
    if (!word) {
      setResults(null);
      setError(null);
      return;
    }

    let active = true;
    async function fetchMatches() {
      try {
        setError(null);
        const res = await getMatches(word);
        if (!active) return;
        setResults(res);
      } catch (e) {
        if (!active) return;
        setError(e.message);
        setResults(null);
      }
    }

    fetchMatches();
    return () => { active = false; };
  }, [inputValue]);

  return (
    <div className="container">
      <h1>Arabic Morphological Analyzer</h1>

      <input
        type="text"
        placeholder="Type any Arabic word"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        className="search-bar"
        autoFocus
      />

      <section>
        <h2>Analysis of “{inputValue || '…'}”</h2>

        {!inputValue.trim() && <p>Type something to see analysis.</p>}
        {error && <p className="error">Error: {error}</p>}

        {results && (
          <>
            <p className="match-step">Match Step: {results.step}</p>

            <div className="panels">
              {/* QAC Panel */}
              <div className="panel panel--qac">
                <h3>QAC Analysis</h3>

                {/* Global stats */}
                <p>
                  Word occurrences: {results.tokenCount} in{' '}
                  {results.tokenRefs.join(', ')}
                </p>
                <p>
                  Root occurrences: {results.rootCount} in{' '}
                  {results.rootRefs.join(', ')}
                </p>

                {results.qac.length === 0 && <p>No QAC matches.</p>}
                {results.qac.map((e, i) => (
                  <div key={i} className="morph-record">
                    <div className="segments">
                      <span className="segment segment--prefix">
                        {e.prefix}
                      </span>
                      <span className="segment segment--stem">
                        {e.stem}
                      </span>
                      <span className="segment segment--suffix">
                        {e.suffix}
                      </span>
                    </div>
                    <ul className="details">
                      <li>Token: {e.token}</li>
                      <li>Root: {e.root}</li>
                      <li>Pattern: {e.pattern || '—'}</li>
                      <li>Lemma: {e.lemma}</li>
                      <li>POS: {e.pos}</li>
                      <li>Meaning: {e.meaning || '—'}</li>
                      <li>
                        Location: Sura {e.sura}, Ayah {e.ayah}
                      </li>
                    </ul>
                  </div>
                ))}
              </div>

              {/* Nemlar Panel */}
              <div className="panel panel--nemlar">
                <h3>Nemlar Analysis</h3>
                {results.nemlar.length === 0 && <p>No Nemlar matches.</p>}
                {results.nemlar.map((e, i) => (
                  <div key={i} className="morph-record">
                    <div className="segments">
                      <span className="segment segment--prefix">
                        {e.prefix}
                      </span>
                      <span className="segment segment--stem">
                        {e.token}
                      </span>
                      <span className="segment segment--suffix">
                        {e.suffix}
                      </span>
                    </div>
                    <ul className="details">
                      <li>Pattern: {e.pattern}</li>
                      <li>Lemma: {e.lemma}</li>
                      <li>POS: {e.pos}</li>
                      <li>Location: Sentence {e.sentenceId}</li>
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default App;