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
  const [corpusJSON, setCorpusJSON]           = useState([]);
  const [corpusIndex, setCorpusIndex]         = useState(new Map());
  const [corpusLoadError, setCorpusLoadError] = useState('');

  const API_URL = 'https://arabic-miracle-api.onrender.com';

  // 1) Normalizer
  function normalizeArabic(str = '') {
    return str
      .normalize('NFC')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')  // strip harakat & tatweel
      .replace(/ٱ|أ|إ|آ/g, 'ا')                    // unify alifs
      .replace(/ﻻ/g, 'لا')                          // fix lam-alif
      .replace(/\u200C/g, '')                       // zero-width joiner
      .replace(/\s+/g, '')                          // whitespace
      .replace(/[^\u0621-\u064A]/g, '')             // non-Arabic
      .trim();
  }

  // 2) Fetch & index the merged JSON once
  useEffect(() => {
    const url = `${process.env.PUBLIC_URL || ''}/quran-qac.json`;
    console.log('⏳ Fetching QAC JSON from:', url);

    fetch(url)
      .then(res => {
        console.log('Fetch status:', res.status, res.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        // Our merge script writes { metadata:…, data: […] }
        const data = Array.isArray(json.data) ? json.data : [];
        if (!data.length) {
          throw new Error('Empty or invalid /quran-qac.json');
        }
        console.log('✅ Loaded corpus entries:', data.length);
        setCorpusJSON(data);

        // Build a Map: normalizedSurface → [entry, …]
        const idx = new Map();
        data.forEach(entry => {
          const key = normalizeArabic(entry.surface);
          if (!key) return;
          const bucket = idx.get(key) || [];
          bucket.push(entry);
          idx.set(key, bucket);
        });

        // Debug
        console.log('🔑 Sample surfaces:', Array.from(idx.keys()).slice(0,10));
        console.log('🔍 "بسم" indexed?', idx.has(normalizeArabic('بسم')));
        if (idx.has(normalizeArabic('بسم'))) {
          console.log('🔢 hits for "بسم":', idx.get(normalizeArabic('بسم')).length);
        }

        setCorpusIndex(idx);
      })
      .catch(err => {
        console.error('❌ Failed to load corpus:', err);
        setCorpusLoadError(
          'تعذر تحميل بيانات الصرف. تأكد من تشغيل سكريبت الدمج قبل البناء.'
        );
      });
  }, []);

  // 3) On “تحليل”
  async function handleAnalyze() {
    setError('');
    setResults([]);

    const w = word.trim();
    if (!w) {
      setError('Please enter an Arabic word');
      return;
    }
    if (!corpusJSON.length) {
      setError('لم يتم تحميل بيانات الصرف بعد.');
      return;
    }

    const target = normalizeArabic(w);
    let merged = [];

    // 3a) Surface-level hits
    const surfaceHits = corpusIndex.get(target) || [];
    if (surfaceHits.length) {
      console.log(`🏷 surface-hits for "${w}":`, surfaceHits.length);
      merged = surfaceHits.map(e => ({
        source: 'qac',
        word:   e.surface,
        pos:    e.pos   || '—',
        lemma:  e.features?.LEM  || '—',
        root:   e.features?.ROOT || '—',
        sura:   e.sura,
        verse:  e.aya
      }));
    }

    // 3b) Lemma fallback
    if (!merged.length) {
      const lemmaHits = corpusJSON.filter(e =>
        normalizeArabic(e.features?.LEM || '') === target
      );
      if (lemmaHits.length) {
        console.log(`🏷 lemma-hits for "${w}":`, lemmaHits.length);
        merged = lemmaHits.map(e => ({
          source: 'qac-lemma',
          word:   e.surface,
          pos:    e.pos   || '—',
          lemma:  e.features?.LEM  || '—',
          root:   e.features?.ROOT || '—',
          sura:   e.sura,
          verse:  e.aya
        }));
      }
    }

    // 3c) Root fallback
    if (!merged.length) {
      const rootHits = corpusJSON.filter(e =>
        normalizeArabic(e.features?.ROOT || '') === target
      );
      if (rootHits.length) {
        console.log(`🏷 root-hits for "${w}":`, rootHits.length);
        merged = rootHits.map(e => ({
          source: 'qac-root',
          word:   e.surface,
          pos:    e.pos   || '—',
          lemma:  e.features?.LEM  || '—',
          root:   e.features?.ROOT || '—',
          sura:   e.sura,
          verse:  e.aya
        }));
      }
    }

    // 3d) Final fallback: your API
    if (!merged.length) {
      console.warn(`⚠️ No local QAC hits for "${w}", querying API…`);
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
        // Merge Nemlar + server QAC as before
        if (data.dataset !== undefined && data.qac !== undefined) {
          const ds = data.dataset, qc = data.qac;
          let rm = rootMap;
          if (!rm) {
            rm = buildRootMap(ds);
            setRootMap(rm);
          }
          merged = [...ds, ...qc];
          if (!qc.length && window.ENABLE_FALLBACK_MATCHER === 'true') {
            const fb = fallbackByRoot(w, rm).map(e => ({ ...e, source: 'fallback' }));
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

      {results.map((r, i) => (
        <div key={i} className="mb-6 border p-4 rounded bg-white">
          <p className="text-sm text-gray-600 mb-2">
            <strong>المصدر:</strong> {r.source}
          </p>
          <p><strong>الكلمة:</strong> {r.word}</p>
          <p><strong>POS:</strong> {r.pos}</p>
          <p><strong>Lemma:</strong> {r.lemma}</p>
          <p><strong>الجذر:</strong> {r.root}</p>
          <p>
            <strong>الموقع:</strong> سورة {r.sura}، آية {r.verse}
          </p>
        </div>
      ))}
    </div>
  );
}
