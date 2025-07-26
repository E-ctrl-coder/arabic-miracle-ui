// src/App.jsx

import React, { useState, useEffect } from 'react';
import JsonCheck from './JsonCheck';
import './index.css';

import {
  buildRootMap,
  fallbackByRoot
} from './utils/fallbackMatcher';

export default function App() {
  const [word, setWord]                       = useState('');
  const [results, setResults]                 = useState([]);
  const [error, setError]                     = useState('');
  const [rootMap, setRootMap]                 = useState(null);
  const [corpusJSON, setCorpusJSON]           = useState(null);
  const [corpusLoadError, setCorpusLoadError] = useState('');

  const API_URL = 'https://arabic-miracle-api.onrender.com';

  // 1) load the merged QAC JSON once
  useEffect(() => {
    fetch('/quran-qac.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (!Array.isArray(json) || json.length === 0) {
          throw new Error('Empty or invalid quran-qac.json');
        }
        console.log('✅ Loaded corpus JSON, total tokens:', json.length);

        // —— DEBUG: inspect one entry’s shape —— 
        console.log('Corpus sample entry:', json[0]);
        console.log('Corpus entry keys:', Object.keys(json[0]));

        setCorpusJSON(json);
      })
      .catch(err => {
        console.error('❌ Failed to load quran-qac.json:', err);
        setCorpusLoadError(
          'ملف quran-qac.json غير موجود أو فارغ. تأكد من تشغيل سكريبت الدمج قبل البناء.'
        );
      });
  }, []);

  // 2) normalize Arabic for matching
  function normalizeArabic(str) {
    return str
      .normalize('NFC')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')  // strip harakat, dagger alif, tatwil
      .replace(/ٱ|أ|إ|آ/g, 'ا')                    // unify alif forms
      .replace(/ﻻ/g, 'لا')                          // ligature
      .replace(/\u200C/g, '')                       // zero-width non-joiner
      .replace(/\s+/g, '')                          // whitespace
      .replace(/[^\u0621-\u064A]/g, '')             // non-Arabic
      .trim();
  }

  // 3) on “تحليل”
  async function handleAnalyze() {
    if (!corpusJSON) {
      setError('تعذر تحليل QAC لأن ملف quran-qac.json لم يُحمّل.');
      return;
    }

    setError('');
    setResults([]);

    const w = word.trim();
    if (!w) {
      setError('Please enter an Arabic word');
      return;
    }

    try {
      // 3a) call API for Nemlar+server QAC
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || `Server error ${res.status}`);
        return;
      }

      const data = await res.json();
      let merged = [];

      // 3b) merge dataset + server qac
      if (data.dataset !== undefined && data.qac !== undefined) {
        const dataset = data.dataset;
        const qac     = data.qac;

        let localRootMap = rootMap;
        if (!localRootMap) {
          localRootMap = buildRootMap(dataset);
          setRootMap(localRootMap);
        }

        merged = [...dataset, ...qac];

        if (
          Array.isArray(qac) && qac.length === 0 &&
          window.ENABLE_FALLBACK_MATCHER === 'true' &&
          localRootMap
        ) {
          console.warn('⚠️ Fallback QAC via Nemlar root for:', w);
          const fallbackEntries = fallbackByRoot(w, localRootMap)
            .map(e => ({ ...e, source: 'fallback' }));
          merged = [...dataset, ...fallbackEntries];
        }

        if (data.suggestion) {
          setError(data.suggestion);
        }
      } else {
        merged = Array.isArray(data) ? data : [data];
      }

      // 3c) now our local QAC hits
      const targetNorm = normalizeArabic(w);
      console.log('📊 Corpus size:', corpusJSON.length);
      console.log('🔍 Looking for normalized token:', targetNorm);

      // — CHANGED BLOCK START —
      const localHits = corpusJSON
        .map(entry => {
          // If there's no `surface`, stitch together any `segments` you do have
          const surfaceText = entry.surface
            || (Array.isArray(entry.segments)
                ? entry.segments.map(seg => seg.text).join('')
                : '');
          return { ...entry, surfaceText };
        })
        .filter(entry => {
          const tokNorm = normalizeArabic(entry.surfaceText);
          return tokNorm === targetNorm;
        })
        .map(entry => ({
          source: 'qac',
          word:   entry.surfaceText,
          pos:    entry.pos    || '—',
          lemma:  entry.features?.LEM  || '—',
          root:   entry.features?.ROOT || '—',
          sura:   entry.sura,
          verse:  entry.aya
        }));
      // — CHANGED BLOCK END —

      console.log('🔢 localHits count:', localHits.length);
      merged = [...merged, ...localHits];

      setResults(merged);
    } catch (e) {
      setError('Network error: ' + e.message);
    }
  }

  // 4) render
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

          {r.segments && (
            <p className="text-xl mb-2">
              {r.segments.map((seg, i) => (
                <span key={i} className={`segment-${seg.type}`}>
                  {seg.text}
                </span>
              ))}
            </p>
          )}

          {r.source === 'dataset' && <>/* …dataset UI… */</>}
          {r.source === 'masaq'   && <>/* …masaq UI…   */</>}

          {r.source === 'qac' && (
            <>
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>POS:</strong> {r.pos}</p>
              <p><strong>Lemma:</strong> {r.lemma}</p>
              <p><strong>الجذر:</strong> {r.root}</p>
              <p><strong>الموقع:</strong> سورة {r.sura}، آية {r.verse}</p>
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
  );
}
