// src/App.jsx
import React, { useState } from 'react'
import './index.css'

export default function App() {
  const [word, setWord]       = useState('')
  const [results, setResults] = useState([])
  const [error, setError]     = useState('')

  // Point this at your live Render URL:
  const API_URL = 'https://arabic-miracle-api.onrender.com'

  async function handleAnalyze() {
    setError('')
    setResults([])

    const w = word.trim()
    if (!w) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      })

      let data
      try {
        data = await res.json()
      } catch {
        setError('Server returned invalid JSON')
        return
      }

      if (!res.ok) {
        setError(data.error || `Server error ${res.status}`)
        return
      }

      setResults(Array.isArray(data) ? data : [data])

    } catch (e) {
      setError('Network error: ' + e.message)
    }
  }

  return (
    <div className="App p-8 bg-gray-50" dir="rtl">
      <h1 className="text-2xl mb-4">محلل الصرف العربي</h1>

      <div className="flex items-center mb-4">
        <input
          type="text"
          value={word}
          onChange={e => setWord(e.target.value)}
          placeholder="أدخل كلمة عربية"
          className="border p-2 w-64"
        />
        <button
          onClick={handleAnalyze}
          className="ml-4 bg-blue-600 text-white p-2 rounded"
        >
          تحليل
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {results.map((r, idx) => (
        <div key={idx} className="mb-6 border p-4 rounded bg-white">
          {/* Source */}
          <p className="text-sm text-gray-600 mb-2">
            <strong>المصدر:</strong> {r.source}
          </p>

          {/* Segments (prefix+root+suffix) */}
          {r.segments && (
            <p className="text-xl mb-2">
              {r.segments.map((seg, i) => (
                <span key={i} className={`segment-${seg.type}`}>
                  {seg.text}
                </span>
              ))}
            </p>
          )}

          {/* Nemlar block */}
          {r.source === 'dataset' && (
            <>
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>الجذر:</strong> {r.root}</p>
              <p><strong>الوزن:</strong> {r.pattern}</p>
              <p><strong>عدد مرات الجذر:</strong> {r.root_occurrences}</p>

              {r.example_verses && r.example_verses.length > 0 && (
                <>
                  <h4 className="mt-4">نماذج من الآيات:</h4>
                  <ol className="list-decimal list-inside">
                    {r.example_verses.map((v, i) => (
                      <li key={i}>
                        <strong>آية {v.sentence_id}:</strong> {v.text}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}

          {/* MASAQ block */}
          {r.source === 'masaq' && (
            <>
              <p><strong>المعنى:</strong> {r.gloss}</p>
              <p><strong>علامة الصرف:</strong> {r.morph_tag}</p>
              <p><strong>نوع الكلمة:</strong> {r.morph_type}</p>
              <p><strong>الدور النحوي:</strong> {r.syntax_role}</p>
              <p>
                <strong>الموقع في القرآن:</strong> {r.sura}:{r.verse}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
