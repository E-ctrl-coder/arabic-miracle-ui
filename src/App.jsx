// src/App.jsx
import React, { useState } from 'react'
import './index.css'

export default function App() {
  const [word, setWord]       = useState('')
  const [results, setResults] = useState([])
  const [error, setError]     = useState('')

  async function handleAnalyze() {
    setError('')
    setResults([])

    const w = word.trim()
    if (!w) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      })
      const data = await res.json()
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
          <p className="text-sm text-gray-600 mb-2">
            المصدر: <strong>{r.source}</strong>
          </p>

          {/* Common: render segments if present */}
          {r.segments && (
            <p className="text-xl mb-2">
              {r.segments.map((seg, i) => (
                <span key={i} className={`segment-${seg.type}`}>
                  {seg.text}
                </span>
              ))}
            </p>
          )}

          {r.source === 'dataset' && (
            <>
              <p>الكلمة الأصلية: {r.word}</p>
              <p>الجذر: {r.root}</p>
              <p>الوزن: {r.pattern}</p>
              <p>عدد مرات الجذر: {r.root_occurrences}</p>

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

          {r.source === 'masaq' && (
            <>
              <p>الكلمة (بدون تشكيل): {r.without_diacritics}</p>
              <p>الكلمة المقسمة: {r.segmented_word}</p>
              <p>Gloss: {r.gloss}</p>
              <p>نوع الصرف: {r.morph_tag}</p>
              <p>نوع الكلمة: {r.morph_type}</p>
              <p>الدور النحوي: {r.syntax_role}</p>
              <p>الموقع في القرآن: {r.sura}:{r.verse}</p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
