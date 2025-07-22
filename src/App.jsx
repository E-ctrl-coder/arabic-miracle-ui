// src/App.jsx
import React, { useState, useEffect } from 'react'
import './index.css'

// ← IMPORT your fallback utils
import {
  cleanSurface,
  buildRootMap,
  fallbackByRoot
} from './utils/fallbackMatcher'

export default function App() {
  const [word, setWord]       = useState('')
  const [results, setResults] = useState([])
  const [error, setError]     = useState('')
  const [rootMap, setRootMap] = useState(null)

  // Point this at your live Render URL:
  const API_URL = 'https://arabic-miracle-api.onrender.com'

  // Build a rootMap from the initial dataset once per session
  useEffect(() => {
    async function initRootMap() {
      // fetch only Nemlar dataset (same data your API returns under dataset)
      const resp = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: '__INIT__' })
      })
      const data = await resp.json()
      const nemlarEntries = Array.isArray(data.dataset)
        ? data.dataset
        : []
      setRootMap(buildRootMap(nemlarEntries))
    }
    initRootMap().catch(console.error)
  }, [])

  async function handleAnalyze() {
    setError('')
    setResults([])

    const w = word.trim()
    if (!w) {
      setError('Please enter an Arabic word')
      return
    }

    let merged = []
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || `Server error ${res.status}`)
        return
      }

      const data = await res.json()
      const dataset = data.dataset || []
      const qac     = data.qac     || []

      // 1️⃣ Merge the two arrays by default
      merged = [...dataset, ...qac]

      // 2️⃣ If QAC missed and fallback enabled, patch in root-based entries
      if (
        Array.isArray(qac) &&
        qac.length === 0 &&
        window.ENABLE_FALLBACK_MATCHER === 'true' &&
        rootMap
      ) {
        console.warn('⚠️ Fallback QAC via Nemlar root for:', w)

        const fallbackEntries = fallbackByRoot(w, rootMap)
          // tag them so you can style differently if you want
          .map(entry => ({ ...entry, source: 'fallback' }))

        merged = [...dataset, ...fallbackEntries]
      }

      // 3️⃣ Any suggestion from the API?
      if (data.suggestion) {
        setError(data.suggestion)
      }

      setResults(merged)
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

          {/* Segments */}
          {r.segments && (
            <p className="text-xl mb-2">
              {r.segments.map((seg, i) => (
                <span key={i} className={`segment-${seg.type}`}>
                  {seg.text}
                </span>
              ))}
            </p>
          )}

          {/* dataset block */}
          {r.source === 'dataset' && (
            <>
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>الجذر:</strong> {r.root}</p>
              {/* ...rest unchanged */}
            </>
          )}

          {/* masaq block */}
          {r.source === 'masaq' && (
            <>
              {/* unchanged */}
            </>
          )}

          {/* qac block */}
          {r.source === 'qac' && (
            <>
              {/* unchanged */}
            </>
          )}

          {/* fallback block */}
          {r.source === 'fallback' && (
            <p className="text-blue-600">
              ⚠️ تم إيجاد تطابق احتياطي عبر جذر Nemlar: {r.root}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
