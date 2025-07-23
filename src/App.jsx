// src/App.jsx
import React, { useState, useEffect } from 'react'
import './index.css'

import {
  buildRootMap,
  fallbackByRoot
} from './utils/fallbackMatcher'

export default function App() {
  const [word, setWord] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [rootMap, setRootMap] = useState(null)
  const [corpusJSON, setCorpusJSON] = useState([])

  const API_URL = 'https://arabic-miracle-api.onrender.com'

  useEffect(() => {
    fetch('/quran-qac.json')
      .then(r => r.json())
      .then(setCorpusJSON)
      .catch(e => console.warn('📛 Failed to load quran-qac.json', e))
  }, [])

  function normalizeArabic(str) {
    return str
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // strip harakat, dagger alif, tatwil
      .replace(/ٱ|أ|إ|آ/g, 'ا')                   // normalize alif forms
      .replace(/ﻻ/g, 'لا')                         // ligature normalization
      .replace(/\s+/g, '')                         // remove spaces
      .replace(/[^\u0621-\u064A]/g, '')            // remove punctuation/non-Arabic
      .trim()
  }

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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || `Server error ${res.status}`)
        return
      }

      const data = await res.json()
      let merged = []

      if (data.dataset !== undefined && data.qac !== undefined) {
        const dataset = data.dataset
        const qac     = data.qac

        let localRootMap = rootMap
        if (!localRootMap) {
          localRootMap = buildRootMap(dataset)
          setRootMap(localRootMap)
        }

        merged = [...dataset, ...qac]

        if (
          Array.isArray(qac) &&
          qac.length === 0 &&
          window.ENABLE_FALLBACK_MATCHER === 'true' &&
          localRootMap
        ) {
          console.warn('⚠️ Fallback QAC via Nemlar root for:', w)
          const fallbackEntries = fallbackByRoot(w, localRootMap)
            .map(entry => ({ ...entry, source: 'fallback' }))
          merged = [...dataset, ...fallbackEntries]
        }

        if (data.suggestion) {
          setError(data.suggestion)
        }

      } else {
        merged = Array.isArray(data) ? data : [data]
      }

      const target = normalizeArabic(w)
      console.log('🔍 Normalized target:', target)

corpusJSON.forEach(entry => {
  const norm = normalizeArabic(entry.word)
  if (norm === target) {
    console.log('✅ QAC match found:', entry)
  }
})
      const localCorpusHits = corpusJSON
        .filter(entry => normalizeArabic(entry.word) === target)
        .map(entry => ({
          source: 'qac',
          word: entry.word,
          pos: entry.qac?.pos || '—',
          lemma: entry.qac?.features?.LEM || '—',
          root: entry.qac?.features?.ROOT || '—',
          sura: entry.sura,
          verse: entry.verse
        }))

      merged = [...merged, ...localCorpusHits]
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
          <p className="text-sm text-gray-600 mb-2">
            <strong>المصدر:</strong> {r.source}
          </p>

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
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>الجذر:</strong> {r.root}</p>

              <p>
                <strong>الوزن الكامل:</strong>{' '}
                {(() => {
                  const pre = r.segments.find(s => s.type === 'prefix')?.text || ''
                  const pat = r.pattern
                  const suf = r.segments.find(s => s.type === 'suffix')?.text || ''
                  return (
                    <>
                      <span className="pattern-affix">{pre}</span>
                      <span className="pattern">{pat}</span>
                      <span className="pattern-affix">{suf}</span>
                    </>
                  )
                })()}
              </p>

              <p><strong>عدد مرات الجذر:</strong> {r.root_occurrences}</p>

              {r.example_verses?.length > 0 && (
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
              <p><strong>المعنى:</strong> {r.gloss}</p>
              <p><strong>علامة الصرف:</strong> {r.morph_tag}</p>
              <p><strong>نوع الكلمة:</strong> {r.morph_type}</p>
              <p><strong>الدور النحوي:</strong> {r.syntax_role}</p>
              <p>
                <strong>الموقع في القرآن:</strong> {r.sura}:{r.verse}
              </p>
            </>
          )}

          {r.source === 'qac' && (
            <>
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>POS:</strong> {r.pos}</p>
              <p><strong>Lemma:</strong> {r.lemma}</p>
              <p><strong>الجذر:</strong> {r.root}</p>
              <p>
                <strong>الموقع:</strong> سورة {r.sura}، آية {r.verse}
              </p>
            </>
          )}

          {r.source === 'fallback' && (
            <p className="text-blue-600">
              ⚠️ تطابق احتياطي عبر جذر Nemlar: {r.root}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
