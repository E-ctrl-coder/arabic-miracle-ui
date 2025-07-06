// src/App.jsx
import React, { useState } from 'react'
import './index.css'

function App() {
  const [word, setWord] = useState('')
  const [prefix, setPrefix] = useState('')
  const [root, setRoot] = useState('')
  const [suffix, setSuffix] = useState('')
  const [pattern, setPattern] = useState('')
  const [occurrences, setOccurrences] = useState(0)
  const [error, setError] = useState('')

  async function handleAnalyze() {
    setError('')
    setPrefix('')
    setRoot('')
    setSuffix('')
    setPattern('')
    setOccurrences(0)

    if (!word.trim()) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Server error ${res.status}`)
        return
      }

      setPrefix(data.prefix)
      setRoot(data.root)
      setSuffix(data.suffix)
      setPattern(data.pattern)
      // use the correct field from the API response
      setOccurrences(data.quran_occurrences)
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
        <p className="error" style={{ color: 'red', marginTop: '1rem' }}>
          {error}
        </p>
      )}

      {root && !error && (
        <div className="result" style={{ marginTop: '1rem' }}>
          <p className="word">
            <span className="segment prefix">{prefix}</span>
            <span className="segment root">{root}</span>
            <span className="segment suffix">{suffix}</span>
          </p>
          {pattern && <p>Pattern (وزن): {pattern}</p>}
          <p>Occurrences in Quran: {occurrences}</p>
        </div>
      )}
    </div>
  )
}

export default App
