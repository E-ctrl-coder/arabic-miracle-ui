import { useState } from 'react';
import './index.css';

function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('https://arabic-miracle-api.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: input }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'An error occurred');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Server error or network issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4 text-center">Arabic Word Analyzer</h1>

      <form onSubmit={handleSubmit} className="flex flex-col items-center mb-6 w-full max-w-md">
        <input
          type="text"
          className="w-full p-3 rounded border border-gray-300 text-right text-xl"
          placeholder="أدخل كلمة عربية"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          dir="rtl"
        />
        <button
          type="submit"
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded"
        >
          {loading ? 'جارٍ التحليل...' : 'تحليل'}
        </button>
      </form>

      {error && <div className="text-red-600 font-semibold">{error}</div>}

      {result && (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-3xl text-right">
          <h2 className="text-xl font-bold mb-2">نتائج التحليل</h2>
          <p><strong>الكلمة:</strong> {result.word}</p>
          <p><strong>الترجمة:</strong> {result.word_translation}</p>
          <p><strong>الجذر:</strong> {result.root}</p>
          <p><strong>ترجمة الجذر:</strong> {result.root_translation}</p>
          <p><strong>الوزن الصرفي:</strong> {result.scale}</p>
          <p><strong>النوع:</strong> {result.type}</p>
          <p><strong>عدد مرات الجذر في القرآن:</strong> {result.occurrences}</p>

          {result.quran_matches.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">الآيات التي تحتوي على الجذر:</h3>
              <ul className="space-y-4">
                {result.quran_matches.map((match, index) => (
                  <li key={index} className="bg-gray-100 p-3 rounded">
                    <p dangerouslySetInnerHTML={{ __html: match.highlighted }}></p>
                    <p className="text-sm text-gray-600">سورة {match.surah}، آية {match.ayah}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
