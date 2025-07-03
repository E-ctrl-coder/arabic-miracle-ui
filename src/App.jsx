// src/App.jsx
import React, { useEffect, useState } from 'react'
import './index.css'

function App() {
  const [word, setWord] = useState('')
  const [rawResponse, setRawResponse] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    console.log('🔌 App mounted')
  }, [])

  async function handleAnalyze() {
    console.log('🔍 handleAnalyze fired with word:', JSON.stringify(word))
    setError('')
    setRawResponse(null)

    if (!word.trim()) {
      console.warn('⛔️ Empty word, showing error')
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch('http://127.0.0.1:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word })
      })
      console.log('📡 Fetch completed. Status:', res.status, res.statusText)

      const data = await res.json().catch(e => {
        console.error('⚠️ JSON parse failed', e)
        throw new Error('Invalid JSON')
      })

      if (!res.ok) {
        console.error('🚨 Server error payload:', data)
        setError(data.error || `Server returned ${res.status}`)
      } else {
        console.log('✅ Received data:', data)
        setRawResponse(data)
      }
    } catch (err) {
      console.error('🔥 handleAnalyze error:', err)
      setError('Network or parsing error: ' + err.message)
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

      {error && (
        <p className="error" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {rawResponse && (
        <div className="debug">
          <h2>🔎 Raw Response</h2>
          <pre style={{ textAlign: 'left', background: '#f4f4f4', padding: '1rem' }}>
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default App
