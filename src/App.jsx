// src/App.jsx
import { useState } from 'react'
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
    if (!word.trim()) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch('http://127.0.0.1:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }))
        setError(err.error || 'Server error')
        return
      }

      const data = await res.json()
      setPrefix(data.prefix)
      setRoot(data.root)
      setSuffix(data.suffix)
      setPattern(data.pattern)
      setOccurrences(data.occurrences)
    } catch (err) {
      setError('Network error: ' + err.message)
    }
  }

  return (
    <div className="App">
      <h1>Arabic Morphology Analyzer</h1>

      <input
        type="text"
        value={word}
        onChange={e => setWord(e.target.value)}
        placeholder="Enter Arabic word"
      />

      <button onClick={handleAnalyze}>
        Analyze
      </button>

      {error && <p className="error">{error}</p>}

      {!error && root && (
        <div className="result">
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
