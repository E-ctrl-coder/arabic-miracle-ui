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

      // populate state from your JSON
      setSegments(data.segments)
      setPattern(data.pattern)
      setRootCount(data.root_occurrences)
      setExamples(data.example_verses)
    } catch (e) {
      setError('Network error: ' + e.message)
    }
  }

  return (
    <div className="App" style={{ padding: '2rem' }}>
      <h1>Arabic Morphology Analyzer</h1>

      <input
        type="text"
        value={word}
        onChange={e => setWord(e.target.value)}
        placeholder="Enter Arabic word"
        style={{ fontSize: '1rem', padding: '0.5rem', width: '200px' }}
      />
      <button onClick={handleAnalyze} style={{ marginLeft: '1rem' }}>
        Analyze
      </button>

      {error && (
        <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>
      )}

      {segments.length > 0 && !error && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* colored word display */}
          <p className="word">
            {segments.map((seg, i) => (
              <span key={i} className={`segment-${seg.type}`}>
                {seg.text}
              </span>
            ))}
          </p>

          <p>Pattern (وزن): {pattern}</p>
          <p>Root occurrences in Quran: {rootCount}</p>

          {examples.length > 0 && (
            <>
              <h4>Example Verses:</h4>
              <ol>
                {examples.map(v => (
                  <li key={v.verseNumber}>
                    <strong>Verse {v.verseNumber}:</strong> {v.text}
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
