import React, { useState } from 'react';
import './index.css'; // you can remove this line if index.css is already loaded in main.jsx

function App() {
  const [word, setWord] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);

    try {
      const res = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || 'Analysis failed');
    } catch {
      setError('Server unreachable');
    }
  };

  return (
    <div className="App">
      <h1>Arabic Miracle Morphology</h1>

      <div className="input-group">
        <input
          type="text"
          placeholder="Enter Arabic word"
          value={word}
          onChange={e => setWord(e.target.value)}
        />
        <button onClick={handleAnalyze}>Analyze</button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="analysis">
          <div className="token">
            {result.prefix && <span className="prefix">{result.prefix}</span>}
            {result.root   && <span className="root">{result.root}</span>}
            {result.suffix && <span className="suffix">{result.suffix}</span>}
            {result.pattern && (
              <div className="pattern">Pattern: {result.pattern}</div>
            )}
          </div>
          {typeof result.root_count === 'number' && (
            <div className="count">
              Occurrences of this root in the Quran: {result.root_count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
