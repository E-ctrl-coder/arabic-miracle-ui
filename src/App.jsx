import React, { useState } from 'react';


function App() {
  const [word, setWord] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('https://your-backend-url.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error occurred.');
      }
    } catch (err) {
      setError('Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">Arabic Miracle Word Analyzer</h1>
      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          placeholder="Enter Arabic word"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          className="input"
        />
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {error && <p className="error">Error: {error}</p>}

      {result && (
        <div className="results">
          <h2>Analysis Result</h2>

          <div dangerouslySetInnerHTML={{ __html: result.colored_word }} />

          <p><strong>Root (Arabic):</strong> <span className="highlight-root">{result.root_arabic}</span></p>
          <p><strong>Root Translation:</strong> {result.root_translation}</p>
          <p><strong>Word Translation:</strong> {result.word_translation}</p>
          <p><strong>Scale:</strong> {result.scale}</p>
          <p><strong>Type:</strong> {result.scale_type}</p>
          <p><strong>Root Occurrences in Qur'an:</strong> {result.root_count}</p>

          <h3>Sample Verses:</h3>
          <ul>
            {result.sample_verses.map((verse, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: verse }}></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
