import React, { useState, useEffect } from 'react';
import { loadQacEntries, loadNemlarSentences, analyzeWord } from './utils/dataLoader';
import './index.css';

function App() {
  const [qacEntries, setQacEntries]           = useState([]);
  const [nemlarSentences, setNemlarSentences] = useState([]);
  const [inputValue, setInputValue]           = useState('');
  const [analysis, setAnalysis]               = useState([]);

  useEffect(() => {
    loadQacEntries()
      .then(setQacEntries)
      .catch(console.error);

    loadNemlarSentences()
      .then(setNemlarSentences)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setAnalysis(analyzeWord(inputValue, qacEntries));
  }, [inputValue, qacEntries]);

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

        {analysis.length === 0 && (
          <p>Type something to see analysis.</p>
        )}

        {analysis.map((seg, idx) => (
          <div key={idx} className="morph-block">
            <strong>Segment:</strong> {seg.segment || '<unknown>'}

            {seg.entries.length === 0 ? (
              <p className="error">No QAC entry found</p>
            ) : (
              seg.entries.map((e, j) => (
                <ul key={j}>
                  <li>Token: {e.token}</li>
                  <li>Root: {e.root}</li>
                  <li>Pattern: {e.pattern}</li>
                  <li>Lemma: {e.lemma}</li>
                  <li>POS: {e.pos}</li>
                </ul>
              ))
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export default App;