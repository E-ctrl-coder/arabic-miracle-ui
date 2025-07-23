// src/App.jsx
import React, { useState, useEffect } from 'react'
import './index.css'

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

  // Load the merged QAC JSON on startup
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

  // Normalize Arabic: strip tashkīl, tatwīl, unify alifs, remove non-letters
  function normalizeArabic(str) {
    return str
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')  // harakat, dagger alif, tatwil
      .replace(/ٱ|أ|إ|آ/g, 'ا')                    // all alifs → bare alif
      .replace(/ﻻ/g, 'لا')                          // lam+alif ligature
      .replace(/\s+/g, '')                          // no spaces
      .replace(/[^\u0621-\u064A]/g, '')             // keep only Arabic letters
      .trim()
  }

  async function handleAnalyze() {
    // If the JSON failed to load, bail out early
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
      // 1) Call your API (Nemlar + server-side QAC)
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

      // 2) Merge Nemlar dataset + server QAC
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
        // if your API returns a single array or object
        merged = Array.isArray(data) ? data : [data]
      }

      // 3) Lookup local QAC from quran-qac.json
      const targetNorm = normalizeArabic(w)

      const localHits = corpusJSON
        .filter(entry => {
          // if you added word_norm in your merge script, use it;
          // otherwise fall back to entry.word
          const token = entry.word_norm || entry.word
          return normalizeArabic(token) === targetNorm
        })
        .map(entry => ({
          source: 'qac',
          word:   entry.word,
          pos:    entry.qac?.pos || '—',
          lemma:  entry.qac?.features?.LEM || '—',
          root:   entry.qac?.features?.ROOT || '—',
          sura:   entry.sura,
          verse:  entry.verse
        }))

      merged = [...merged, ...localHits]
      setResults(merged)

    } catch (e) {
      setError('Network error: ' + e.message)
    }
  }

  return (
    <div className="App p-8 bg-gray-50" dir="rtl">
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
