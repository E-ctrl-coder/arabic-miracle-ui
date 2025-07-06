// src/App.jsx
import React, { useState } from 'react'
import './index.css'

function App() {
  const [word, setWord] = useState('')
  const [segments, setSegments] = useState([])
  const [pattern, setPattern] = useState('')
  const [rootCount, setRootCount] = useState(null)
  const [examples, setExamples] = useState([])
  const [error, setError] = useState('')

  async function handleAnalyze() {
    setError('')
    setSegments([])
    setPattern('')
    setRootCount(null)
    setExamples([])

    if (!word.trim()) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim() })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Server error ${res.status}`)
        return
      }

      setSegments(data.segments)
      setPattern(data.pattern)
      setRootCount(data.root_occurrences)
      setExamples(data.example_verses)
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

      {error && (
        <p className="text-red-600 mb-4">{error}</p>
      )}

      {segments.length > 0 && !error && (
        <div className="space-y-3">
          <p className="text-xl">
            {segments.map((seg, i) => (
              <span key={i} className={seg.type}>
                {seg.text}
              </span>
            ))}
          </p>

          <p>الوزن (Pattern): {pattern}</p>
          <p>عدد مرات الجذر في القرآن: {rootCount}</p>

          {examples.length > 0 && (
            <>
              <h4 className="mt-4">نماذج من الآيات:</h4>
              <ol className="list-decimal list-inside">
                {examples.map(v => (
                  <li key={v.verseNumber}>
                    <strong>آية {v.verseNumber}:</strong> {v.text}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App
