// App.jsx
import { useState } from 'react';

export default function App() {
  const [word, setWord] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeWord = async () => {
    if (!word.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('https://arabic-miracle-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('API error:', err);
      setResult({ error: 'Failed to fetch analysis.' });
    } finally {
      setLoading(false);
    }
  };

  const highlightWord = () => {
    const { highlight } = result;
    const chars = word.split('');
    return chars.map((ch, i) => {
      let color = 'text-black';
      if (i >= highlight.root[0] && i <= highlight.root[1]) color = 'text-green-600';
      else if (i >= highlight.prefix[0] && i <= highlight.prefix[1]) color = 'text-blue-600';
      else if (i >= highlight.suffix[0] && i <= highlight.suffix[1]) color = 'text-red-600';
      return <span key={i} className={color}>{ch}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Arabic Word Analyzer</h1>
      <input
        className="border p-2 rounded w-72 mb-4 text-right"
        placeholder="أدخل كلمة عربية"
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <button
        onClick={analyzeWord}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Analyze
      </button>

      {loading && <p className="mt-4">Analyzing...</p>}

      {result && !result.error && (
        <div className="mt-6 bg-white shadow rounded p-4 w-full max-w-md">
          <h2 className="font-semibold mb-2">Root:</h2>
          <p className="text-green-700">{result.root}</p>

          <h2 className="font-semibold mt-4 mb-2">Translation:</h2>
          <p>{result.translation}</p>

          <h2 className="font-semibold mt-4 mb-2">Highlighted Word:</h2>
          <p className="text-xl font-mono text-right">{highlightWord()}</p>

          <h2 className="font-semibold mt-4 mb-2">Examples:</h2>
          <ul className="list-disc list-inside">
            {result.examples.map((ex, i) => (
              <li key={i}><span className="font-bold">{ex.ayah}</span>: {ex.translation}</li>
            ))}
          </ul>
        </div>
      )}

      {result?.error && <p className="text-red-500 mt-4">{result.error}</p>}
    </div>
  );
}
