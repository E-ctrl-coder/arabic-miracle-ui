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
  const [corpusIndex, setCorpusIndex]         = useState(new Map());
  const [corpusLoadError, setCorpusLoadError] = useState('');

  const API_URL = 'https://arabic-miracle-api.onrender.com';

  // 1) Normalizer
  function normalizeArabic(str) {
    return str
      .normalize('NFC')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')  // strip harakat & tatweel
      .replace(/ٱ|أ|إ|آ/g, 'ا')                    // unify alifs
      .replace(/ﻻ/g, 'لا')                          // ligature
      .replace(/\u200C/g, '')                       // zero-width non-joiner
      .replace(/\s+/g, '')                          // whitespace
      .replace(/[^\u0621-\u064A]/g, '')             // non-Arabic
      .trim();
  }

  // 2) Load & index the corpus once
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

        console.log('✅ Loaded corpus JSON, total entries:', json.length);

        const idx = new Map();

        json.forEach((entry, ix) => {
          // 2a) stitch segments => raw surface
          const raw = Array.isArray(entry.segments)
            ? entry.segments
                .map(s => 
                  s.text
                    .replace(/\u200C/g, '')  // remove zero-width
                    .replace(/\u0640/g, '')  // remove tatweel
                )
                .join('')
            : '';

          // 2b) normalize
          const key = normalizeArabic(raw);
          if (!key) return;

          // 2c) push into map
          const bucket = idx.get(key) || [];
          bucket.push({ ...entry, _surface: raw });
          idx.set(key, bucket);
        });

        // DEBUG: inspect a few keys
        console.log('🔑 Sample normalized keys:', Array.from(idx.keys()).slice(0, 10));
        // DEBUG: confirm بسم is in the index
        console.log('🔍 "بسم" in index?', idx.has(normalizeArabic('بسم')));
        if (idx.has(normalizeArabic('بسم'))) {
          console.log('🔢 Hits for بسم:', idx.get(normalizeArabic('بسم')).length);
        }

        setCorpusIndex(idx);
      })
      .catch(err => {
        console.error('❌ Failed to load corpus:', err);
        setCorpusLoadError(
          'ملف quran-qac.json غير موجود أو فارغ. تأكد من تشغيل سكريبت الدمج قبل البناء.'
        );
      });
  }, []);

  // 3) on “تحليل”
  async function handleAnalyze() {
    setError('');
    setResults([]);

    const w = word.trim();
    if (!w) {
      setError('Please enter an Arabic word');
      return;
    }

    const target = normalizeArabic(w);

    // 3a) local index lookup
    const localBucket = corpusIndex.get(target) || [];
    let merged = [];

    if (localBucket.length) {
      console.log(`🏷 Found ${localBucket.length} local hits for "${w}"`);
      merged = localBucket.map(entry => ({
        source: 'qac',
        word:   entry._surface,
        pos:    entry.pos     || '—',
        lemma:  entry.features?.LEM  || '—',
        root:   entry.features?.ROOT || '—',
        sura:   entry.sura,
        verse:  entry.aya
      }));
    } else {
      console.warn(`⚠️ No local hits for "${w}", falling back to API...`);
      try {
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
        // merge dataset + server QAC
        if (data.dataset !== undefined && data.qac !== undefined) {
          const ds = data.dataset;
          const qac = data.qac;
          let localRm = rootMap;
          if (!localRm) {
            localRm = buildRootMap(ds);
            setRootMap(localRm);
          }
          merged = [...ds, ...qac];
          if (
            Array.isArray(qac) && qac.length === 0 &&
            window.ENABLE_FALLBACK_MATCHER === 'true' &&
            localRm
          ) {
            const fb = fallbackByRoot(w, localRm)
              .map(e => ({ ...e, source: 'fallback' }));
            merged = [...ds, ...fb];
          }
          if (data.suggestion) setError(data.suggestion);
        } else {
          merged = Array.isArray(data) ? data : [data];
        }
      } catch (e) {
        setError('Network error: ' + e.message);
      }
    }

    setResults(merged);
  }

  // 4) render
  return (
    <div className="App p-8 bg-gray-50" dir="rtl">
      <JsonCheck />

      <h1 className="text-2xl mb-4">محل الصرف العربي</h1>

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

          {r.source === 'qac' && (
            <>
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>POS:</strong> {r.pos}</p>
              <p><strong>Lemma:</strong> {r.lemma}</p>
              <p><strong>الجذر:</strong> {r.root}</p>
              <p><strong>الموقع:</strong> سورة {r.sura}، آية {r.verse}</p>
            </>
          )}

          {r.source === 'dataset' && <>/* …dataset UI… */</>}
          {r.source === 'masaq'   && <>/* …masaq UI… */</>}
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
