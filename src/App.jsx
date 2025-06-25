import { useState } from 'react';
import './index.css';

function App() {
  const [word, setWord] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeWord = async () => {
    if (!word.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('https://your-backend-url.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to analyze word.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Network or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Arabic Word Analyzer</h1>
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter Arabic word..."
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <button onClick={analyzeWord} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <p><strong>Root (Arabic):</strong> {result.root_ar}</p>
          <p><strong>Root (English):</strong> {result.root_en}</p>
          <p><strong>Word Translation:</strong> {result.word_en}</p>
          <p><strong>Scale:</strong> {result.scale}</p>
          <p><strong>Scale Type:</strong> {result.scale_type}</p>
          <p><strong>Root Occurrences:</strong> {result.root_occurrences}</p>
          <p><strong>Word Coloring:</strong> <span dangerouslySetInnerHTML={{ __html: result.word_colored }} /></p>

          <div>
            <h3>Qur’anic Verses with Root Highlighted:</h3>
            {result.verses.map((verse, i) => {
              const [surah, ayah, text] = verse.split('|');
              return (
                <div key={i} className="verse">
                  <p><strong>Surah {surah}, Ayah {ayah}:</strong></p>
                  <p dir="rtl" dangerouslySetInnerHTML={{ __html: text }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
