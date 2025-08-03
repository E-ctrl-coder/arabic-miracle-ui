// src/App.jsx

import React, { useState, useEffect } from 'react';
import { getMatches } from './utils/dataLoader'

/**
 * Renders a colored segment (prefix / stem / suffix).
 * Won't render anything if text is empty.
 */
function Segment({ text, type }) {
  if (!text) return null;
  return (
    <span className={`segment segment--${type}`}>
      {text}
    </span>
  );
}

/**
 * One-panel of analysis, either QAC or Nemlar.
 * isQac toggles the extra stats & fields.
 */
function AnalysisPanel({ title, classSuffix, data, isQac = false }) {
  return (
    <div className={`panel panel--${classSuffix}`}>
      <h3>{title}</h3>

      {isQac && (
        <>
          <p>
            Word occurrences: {data.tokenCount} in {data.tokenRefs.join(', ')}
          </p>
          <p>
            Root occurrences: {data.rootCount} in {data.rootRefs.join(', ')}
          </p>
        </>
      )}

      {isQac && data.qac.length === 0 && <p>No QAC matches.</p>}
      {!isQac && data.nemlar.length === 0 && <p>No Nemlar matches.</p>}

      {(isQac ? data.qac : data.nemlar).map((e, i) => (
        <div key={i} className="morph-record">
          <div className="segments">
            <Segment text={e.prefix} type="prefix" />
            <Segment text={isQac ? e.stem : e.token} type="stem" />
            <Segment text={e.suffix} type="suffix" />
          </div>
          <ul className="details">
            {isQac && <li>Token: {e.token}</li>}
            {isQac && <li>Root: {e.root}</li>}
            <li>Pattern: {(e.pattern || '—')}</li>
            <li>Lemma: {e.lemma}</li>
            <li>POS: {e.pos}</li>
            {isQac && <li>Meaning: {(e.meaning || '—')}</li>}
            {isQac
              ? <li>Location: Sura {e.sura}, Ayah {e.ayah}</li>
              : <li>Location: Sentence {e.sentenceId}</li>
            }
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function App() {
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
    (async () => {
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
    })();

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
              <AnalysisPanel
                title="QAC Analysis"
                classSuffix="qac"
                data={results}
                isQac
              />
              <AnalysisPanel
                title="Nemlar Analysis"
                classSuffix="nemlar"
                data={results}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}