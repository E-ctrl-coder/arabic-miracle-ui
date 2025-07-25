// src/App.jsx
import React, { useState, useEffect } from 'react';
import JsonCheck from './JsonCheck';
import './index.css';

import {
  buildRootMap,
  fallbackByRoot
} from './utils/fallbackMatcher'

export default function App() {
  const [word, setWord]                = useState('')
  const [results, setResults]          = useState([])
  const [error, setError]              = useState('')
  const [rootMap, setRootMap]          = useState(null)
  const [corpusJSON, setCorpusJSON]    = useState(null)
  const [corpusLoadError, setCorpusLoadError] = useState('')

  const API_URL = 'https://arabic-miracle-api.onrender.com'

  // 1) Load merged QAC JSON once at startup
  useEffect(() => {
    fetch('/quran-qac.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!Array.isArray(json) || json.length === 0) {
          throw new Error('Empty or invalid quran-qac.json')
        }
        setCorpusJSON(json)
      })
      .catch(err => {
        console.error('❌ Failed to load quran-qac.json:', err)
        setCorpusLoadError(
          'ملف quran-qac.json غير موجود أو فارغ. تأكد من تشغيل سكريبت الدمج قبل البناء.'
        )
      })
  }, [])

  // 2) Normalize Arabic input and tokens
  function normalizeArabic(str) {
    return str
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')  // strip harakat, dagger alif, tatwil
      .replace(/ٱ|أ|إ|آ/g, 'ا')                    // unify alif forms
      .replace(/ﻻ/g, 'لا')                          // ligature
      .replace(/\s+/g, '')                          // remove spaces
      .replace(/[^\u0621-\u064A]/g, '')             // remove non-Arabic
      .trim()
  }

  // 3) Handle “تحليل” click
  async function handleAnalyze() {
    if (!corpusJSON) {
      setError('تعذر تحليل QAC لأن ملف quran-qac.json لم يُحمّل.')
      return
    }

    setError('')
    setResults([])

    const w = word.trim()
    if (!w) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      // 3a) Call your API (Nemlar + server QAC)
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        setError(errJson.error || `Server error ${res.status}`)
        return
      }

      const data = await res.json()
      let merged = []

      // 3b) Merge Nemlar “dataset” + server “qac”
      if (data.dataset !== undefined && data.qac !== undefined) {
        const dataset = data.dataset
        const qac     = data.qac

        // build rootMap once
        let localRootMap = rootMap
        if (!localRootMap) {
          localRootMap = buildRootMap(dataset)
          setRootMap(localRootMap)
        }

        merged = [...dataset, ...qac]

        // optional fallback via root
        if (
          Array.isArray(qac) &&
          qac.length === 0 &&
          window.ENABLE_FALLBACK_MATCHER === 'true' &&
          localRootMap
        ) {
          console.warn('⚠️ Fallback QAC via Nemlar root for:', w)
          const fallbackEntries = fallbackByRoot(w, localRootMap)
            .map(e => ({ ...e, source: 'fallback' }))
          merged = [...dataset, ...fallbackEntries]
        }

        if (data.suggestion) {
          setError(data.suggestion)
        }
      } else {
        merged = Array.isArray(data) ? data : [data]
      }

      // 3c) Now append your local QAC hits from quran-qac.json
      const targetNorm = normalizeArabic(w)
      console.log('📊 Corpus size:', corpusJSON.length)
      console.log('🔍 Looking for normalized token:', targetNorm)

      const localHits = corpusJSON
        .filter(entry => {
          // ← only real corpus hits (entry.qac !== null)
          if (!entry.qac) return false

          // ← match on normalized token (prefer precomputed word_norm)
          const tokenNorm = normalizeArabic(entry.word_norm || entry.word)
          return tokenNorm === targetNorm
        })
        .map(entry => {
          console.log('✅ QAC match found:', entry)
          return {
            source: 'qac',
            word:   entry.word,
            pos:    entry.qac?.pos  || '—',
            lemma:  entry.qac?.features?.LEM  || '—',
            root:   entry.qac?.features?.ROOT || '—',
            sura:   entry.sura,
            verse:  entry.verse
          }
        })

      console.log('🔢 localHits count:', localHits.length)
      merged = [...merged, ...localHits]

      setResults(merged)
    } catch (e) {
      setError('Network error: ' + e.message)
    }
  }

  // 4) Render
  return (
    <div className="App p-8 bg-gray-50" dir="rtl">
       <JsonCheck />
      <h1 className="text-2xl mb-4">محلل الصرف العربي</h1>

      {corpusLoadError && (
        <div className="mb-4 p-4 bg-red-200 text-red-800 rounded">
          {corpusLoadError}
        </div>
      )}

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

          {/* your original rendering logic unchanged */}
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
              {/* …existing dataset block… */}
            </>
          )}

          {r.source === 'masaq' && (
            <>
              {/* …existing masaq block… */}
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
