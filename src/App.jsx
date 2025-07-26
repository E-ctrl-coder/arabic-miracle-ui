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
        setCorpusJSON(json);

        // build a Map: normalizedSurface → [entries]
        const idx = new Map();
        json.forEach(entry => {
          // stitch segments → raw surface
          const raw = Array.isArray(entry.segments)
            ? entry.segments.map(s => s.text).join('')
            : '';
          const key = normalizeArabic(raw);
          if (!key) return;
          const bucket = idx.get(key) || [];
          bucket.push({ ...entry, _surface: raw });
          idx.set(key, bucket);
        });

        // debug
        console.log('🔑 Sample keys:', Array.from(idx.keys()).slice(0,10));
        console.log('🔍 "بسم" in surface index?', idx.has(normalizeArabic('بسم')));
        if (idx.has(normalizeArabic('بسم'))) {
          console.log('🔢 surface-hits for بسم:', idx.get(normalizeArabic('بسم')).length);
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
    if (!corpusJSON) {
      setError('تعذر تحليل QAC لأن ملف quran-qac.json لم يُحمّل.');
      return;
    }

    const target = normalizeArabic(w);
    let merged = [];

    // 3a) surface-form lookup
    const surfaceHits = corpusIndex.get(target) || [];
    if (surfaceHits.length) {
      console.log(`🏷 surface-hits for "${w}":`, surfaceHits.length);
      merged = surfaceHits.map(entry => ({
        source: 'qac',
        word:   entry._surface,
        pos:    entry.pos     || '—',
        lemma:  entry.features?.LEM  || '—',
        root:   entry.features?.ROOT || '—',
        sura:   entry.sura,
        verse:  entry.aya
      }));
    }

    // 3b) lemma fallback
    if (!merged.length) {
      const lemmaHits = corpusJSON.filter(e =>
        normalizeArabic(e.features?.LEM || '') === target
      );
      if (lemmaHits.length) {
        console.log(`🏷 lemma-hits for "${w}":`, lemmaHits.length);
        merged = lemmaHits.map(entry => ({
          source: 'qac-lemma',
          word:   entry.segments.map(s => s.text).join(''),
          pos:    entry.pos     || '—',
          lemma:  entry.features?.LEM  || '—',
          root:   entry.features?.ROOT || '—',
          sura:   entry.sura,
          verse:  entry.aya
        }));
      }
    }

    // 3c) root fallback
    if (!merged.length) {
      const rootHits = corpusJSON.filter(e =>
        normalizeArabic(e.features?.ROOT || '') === target
      );
      if (rootHits.length) {
        console.log(`🏷 root-hits for "${w}":`, rootHits.length);
        merged = rootHits.map(entry => ({
          source: 'qac-root',
          word:   entry.segments.map(s => s.text).join(''),
          pos:    entry.pos     || '—',
          lemma:  entry.features?.LEM  || '—',
          root:   entry.features?.ROOT || '—',
          sura:   entry.sura,
          verse:  entry.aya
        }));
      }
    }

    // 3d) final API fallback if still empty
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
        // merge Nemlar + server QAC
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

      {results.map((r, i) => (
        <div key={i} className="mb-6 border p-4 rounded bg-white">
          <p className="text-sm text-gray-600 mb-2">
            <strong>المصدر:</strong> {r.source}
          </p>

          {r.source.startsWith('qac') && (
            <>
              <p><strong>الكلمة الأصلية:</strong> {r.word}</p>
              <p><strong>POS:</strong> {r.pos}</p>
              <p><strong>Lemma:</strong> {r.lemma}</p>
              <p><strong>الجذر:</strong> {r.root}</p>
              <p><strong>الموقع:</strong> سورة {r.sura}، آية {r.verse}</p>
            </>
          )}

          {r.source === 'dataset' && <>/* …dataset UI… */</>}
          {r.source === 'masaq'   && <>/* …masaq UI…   */</>}
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
