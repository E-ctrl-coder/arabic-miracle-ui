// src/App.jsx
import React, { useState, useEffect } from 'react';
import { loadCorpora } from './dataLoader';

export default function App() {
  const [corpora, setCorpora] = useState(null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    loadCorpora()
      .then(setCorpora)
      .catch(err => setError(err.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red' }}>
        Error loading data: {error}
      </div>
    );
  }

  if (!corpora) {
    return (
      <div style={{ padding: '1rem' }}>
        Loading morphological data…
      </div>
    );
  }

  // Simple input state
  const [text, setText] = useState('');
  const tokens = text.trim().split(/\s+/).filter(t => t);

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Arabic Analyzer</h2>
      <textarea
        rows={3}
        cols={50}
        placeholder="Type Arabic words separated by spaces"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {tokens.map(token => (
        <div
          key={token}
          style={{
            display: 'flex',
            gap: '2rem',
            borderTop: '1px solid #ddd',
            marginTop: '1rem',
            paddingTop: '0.5rem'
          }}
        >
          <div>
            <strong>QAC</strong>
            <ul>
              {(corpora.qac[token] || ['no QAC analysis']).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Nemlar</strong>
            <ul>
              {(corpora.nemlar[token] || ['no Nemlar analysis']).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
