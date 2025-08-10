// WordAnalyzer.jsx
// React component (default export) for Arabic Word Morphology Analyzer
// Place this file in src/components/WordAnalyzer.jsx (or src/WordAnalyzer.jsx)
// Requirements:
// - Tailwind CSS available in the project
// - public/qac.json (your processed QAC JSON) placed in the project's public folder and accessible at '/qac.json'
// - public/quraan.txt (Arabic Quran text, numbered as surah:verse lines) accessible at '/quraan.txt'
// - Vite or similar dev server so public files are served at project root

import React, {useEffect, useMemo, useState} from 'react'

// Utility: strip Arabic diacritics and tatweel
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
const TATWEEL = /\u0640/g

function normalizeArabic(s) {
  if (!s) return ''
  // remove diacritics and tatweel, normalize Alef variants to ا, normalize hamza on alifs
  return s
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ۥ/g, '')
    .trim()
}

// Heuristic list of common prefixes and suffixes (letters/strings) to peel off
const COMMON_PREFIXES = ['ال', 'و', 'ف', 'ب', 'ك', 'ل', 'س', 'سوف', 'بال', 'لل']
const COMMON_SUFFIXES = ['ه', 'ها', 'هم', 'هن', 'كما', 'كم', 'نا', 'ا', 'ان', 'ين', 'ون', 'ات', 'ة', 'ي']

// Detect qac JSON shape and normalize into a list of entries with keys: surah, verse, word_index, arabic, segments, root, lemma, pattern, pos, gloss
function flattenQac(raw) {
  // Accepts multiple shapes: nested {surah:{verse:[words]}} or array of records
  const out = []
  if (Array.isArray(raw)) {
    // array of objects with verse_id or surah/verse
    for (const rec of raw) {
      if (rec.verse_id) {
        // expect word_index, word_ar, lemma_ar, root, pattern, pos
        out.push({
          surah: Number(rec.verse_id.split(':')[0]),
          verse: Number(rec.verse_id.split(':')[1]),
          word_index: rec.word_index || 0,
          arabic: rec.word_ar || rec.arabic || rec.word || '',
          segments: rec.segments || null,
          root: rec.root || rec.root_ar || rec.root_bw || '',
          lemma: rec.lemma_ar || rec.lemma || rec.lemma_bw || '',
          pattern: rec.pattern || '',
          pos: rec.pos || rec.pos_tag || '',
          gloss: rec.gloss || ''
        })
      } else if (rec.surah && rec.ayah) {
        out.push({
          surah: Number(rec.surah),
          verse: Number(rec.ayah),
          word_index: rec.word_index || 0,
          arabic: rec.arabic || rec.word_ar || '',
          segments: rec.segments || null,
          root: rec.root || '',
          lemma: rec.lemma || '',
          pattern: rec.pattern || '',
          pos: rec.pos || '',
          gloss: rec.gloss || ''
        })
      } else {
        // generic
        out.push({
          surah: rec.surah || 0,
          verse: rec.verse || 0,
          word_index: rec.word_index || 0,
          arabic: rec.arabic || rec.word || '',
          segments: rec.segments || null,
          root: rec.root || '',
          lemma: rec.lemma || '',
          pattern: rec.pattern || '',
          pos: rec.pos || '',
          gloss: rec.gloss || ''
        })
      }
    }
  } else {
    // object keyed by surah -> verse -> array
    for (const s of Object.keys(raw)) {
      const sNum = Number(s)
      const verses = raw[s]
      if (!verses) continue
      for (const v of Object.keys(verses)) {
        const vNum = Number(v)
        const words = verses[v]
        if (!Array.isArray(words)) continue
        for (const w of words) {
          out.push({
            surah: sNum,
            verse: vNum,
            word_index: w.word_index || w.index || 0,
            arabic: w.arabic || w.word_ar || w.surface || '',
            segments: w.segments || null,
            root: (w.root || (w.tags && w.tags.ROOT) || ''),
            lemma: w.lemma || (w.tags && w.tags.LEM) || '',
            pattern: w.pattern || (w.tags && w.tags.PATTERN) || '',
            pos: w.pos || '' ,
            gloss: w.gloss || w.english || ''
          })
        }
      }
    }
  }
  return out
}

export default function WordAnalyzer() {
  const [qac, setQac] = useState(null)
  const [qacFlat, setQacFlat] = useState([])
  const [quraanText, setQuraanText] = useState(null) // mapping surah->verse->text
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        // adjust paths: in Vite public folder -> '/qac.json' and '/quraan.txt'
        const [qacRes, quraanRes] = await Promise.all([
          fetch('/qac.json'),
          fetch('/quraan.txt')
        ])
        if (!qacRes.ok) throw new Error('Failed to load qac.json')
        if (!quraanRes.ok) throw new Error('Failed to load quraan.txt')
        const qacData = await qacRes.json()
        const quraanTextRaw = await quraanRes.text()

        // parse quraan.txt: expect lines like '2:3|' or similar; we'll accept common formats
        const quraanMap = parseQuraanText(quraanTextRaw)

        const flat = flattenQac(qacData)
        setQac(qacData)
        setQacFlat(flat)
        setQuraanText(quraanMap)
        setLoading(false)
      } catch (e) {
        console.error(e)
        setError(e.message)
        setLoading(false)
      }
    }
    load()
  }, [])

  function parseQuraanText(txt) {
    // input expected as lines like: '2:3	بِسْمِ ...' or '(2:3) ...' or '2:3|...' We try to handle several.
    const lines = txt.split(/\r?\n/)
    const map = {}
    for (const line of lines) {
      if (!line.trim()) continue
      // try formats
      // format A: 2:3	<verse text>
      let m = line.match(/^(\d+):(\d+)\s+[\t ]+(.+)$/)
      if (m) {
        const s = Number(m[1]), v = Number(m[2]), text = m[3].trim()
        map[`${s}:${v}`] = text
        continue
      }
      // format B: (2:3:1) ... lines per word (not useful here)
      m = line.match(/^\((\d+):(\d+)\)\s*(.+)$/)
      if (m) {
        const s = Number(m[1]), v = Number(m[2]), text = m[3].trim()
        map[`${s}:${v}`] = text
        continue
      }
      // format C: surah|verse|text
      m = line.match(/^(\d+)\|(\d+)\|(.+)$/)
      if (m) {
        const s = Number(m[1]), v = Number(m[2]), text = m[3].trim()
        map[`${s}:${v}`] = text
        continue
      }
    }
    return map
  }

  // --- Search functions ---
  function exactSearch(q) {
    // find qacFlat entries whose arabic === q OR whose lemma matches etc.
    return qacFlat.filter(e => e.arabic === q || e.lemma === q || e.root === q)
  }

  function normalizedSearch(q) {
    const n = normalizeArabic(q)
    return qacFlat.filter(e => normalizeArabic(e.arabic) === n || normalizeArabic(e.lemma || '') === n || normalizeArabic(e.root || '') === n)
  }

  function affixStripSearch(q) {
    const n = normalizeArabic(q)
    // peel prefixes
    const candidates = new Set()
    for (const pre of COMMON_PREFIXES) {
      if (n.startsWith(pre)) {
        const core = n.slice(pre.length)
        for (const suf of COMMON_SUFFIXES) {
          let core2 = core
          if (core.endsWith(suf)) core2 = core.slice(0, core.length - suf.length)
          candidates.add(core2)
        }
        candidates.add(core)
      }
    }
    // also try removing suffixes directly
    for (const suf of COMMON_SUFFIXES) {
      if (n.endsWith(suf)) candidates.add(n.slice(0, n.length - suf.length))
    }
    // search qacFlat for matches on stems/lemma/root after normalization
    const results = []
    for (const c of candidates) {
      for (const e of qacFlat) {
        if (normalizeArabic(e.lemma || '') === c || normalizeArabic(e.root || '') === c || normalizeArabic(e.arabic || '') === c) {
          results.push(e)
        }
      }
    }
    return results
  }

  function findOccurrencesForEntry(entry) {
    // return array of {surah,verse,word_index, contextText}
    const key = `${entry.surah}:${entry.verse}`
    const context = quraanText ? quraanText[key] : null
    return [{surah: entry.surah, verse: entry.verse, word_index: entry.word_index, context}]
  }

  function analyzeInput() {
    if (!qacFlat || qacFlat.length === 0) return
    setResults(null)
    const q = query.trim()
    if (!q) return

    // Step 1: exact
    let matched = exactSearch(q)

    // Step 2: normalized
    if (matched.length === 0) matched = normalizedSearch(q)

    // Step 3: affix stripping
    if (matched.length === 0) matched = affixStripSearch(q)

    // dedupe by surah:verse:word_index
    const seen = new Set()
    const deduped = []
    for (const m of matched) {
      const id = `${m.surah}:${m.verse}:${m.word_index}`
      if (!seen.has(id)) {
        seen.add(id)
        deduped.push(m)
      }
    }

    // group by root/stem
    const byRoot = {}
    for (const d of deduped) {
      const r = d.root || d.lemma || '—'
      if (!byRoot[r]) byRoot[r] = []
      byRoot[r].push(d)
    }

    setResults({raw: deduped, byRoot})
  }

  // UI helpers: render letters with colors for prefixes/stem/suffixes
  function renderColoredWord(entry) {
    // If segments info exists, use that, otherwise heuristically split by lemma
    const segments = entry.segments
    if (segments && (segments.prefixes || segments.stem || segments.suffixes)) {
      const pieces = []
      if (segments.prefixes && segments.prefixes.length) {
        for (const p of segments.prefixes) pieces.push({type: 'p', text: p.form})
      }
      if (segments.stem) pieces.push({type: 's', text: segments.stem.form || segments.stem})
      if (segments.suffixes && segments.suffixes.length) {
        for (const s of segments.suffixes) pieces.push({type: 'x', text: s.form})
      }
      return <span className="inline-flex items-center gap-0">
        {pieces.map((pc, i) => (
          <span key={i} className={pc.type === 'p' ? 'text-blue-600' : pc.type === 's' ? 'text-green-700 font-semibold' : 'text-red-600'}>{pc.text}</span>
        ))}
      </span>
    }

    // fallback: try to match lemma inside word
    const w = entry.arabic || ''
    const lemma = entry.lemma || ''
    if (lemma && w.includes(lemma)) {
      const parts = w.split(lemma)
      return <span>
        <span className="text-blue-600">{parts[0]}</span>
        <span className="text-green-700 font-semibold">{lemma}</span>
        <span className="text-red-600">{parts[1]}</span>
      </span>
    }

    return <span>{w}</span>
  }

  function showVerse(surah, verse) {
    const key = `${surah}:${verse}`
    return quraanText && quraanText[key] ? quraanText[key] : 'Verse text not found in quraan.txt'
  }

  // ----- Render -----
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-3">Arabic Word Morphology Analyzer</h1>

      {loading && <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">Loading qac.json and quraan.txt ...</div>}
      {error && <div className="p-4 bg-red-50 border-l-4 border-red-400">Error: {error}</div>}

      <div className="mt-4 flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Enter Arabic word (paste or type)" className="flex-1 border rounded p-2" />
        <button onClick={analyzeInput} className="bg-sky-600 text-white px-4 py-2 rounded">Analyze</button>
      </div>

      {!results && !loading && <p className="mt-3 text-sm text-slate-600">Type an Arabic word and click Analyze. Search steps: exact → normalized → affix-stripped.</p>}

      {results && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Results</h2>

          {Object.keys(results.byRoot).map((rootKey) => (
            <div key={rootKey} className="mt-4 p-3 border rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Root / Lemma</div>
                  <div className="text-lg font-bold">{rootKey}</div>
                </div>
                <div className="text-sm text-right">
                  <div>{results.byRoot[rootKey].length} hit(s)</div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {results.byRoot[rootKey].map((entry, idx) => (
                  <div key={idx} className="p-2 border rounded grid grid-cols-6 gap-2 items-center">
                    <div className="col-span-2">{renderColoredWord(entry)}</div>
                    <div className="text-xs text-slate-500">{entry.pos}</div>
                    <div className="text-xs">Pattern: {entry.pattern || '—'}</div>
                    <div className="text-xs">Lemma: {entry.lemma || '—'}</div>
                    <div className="text-right text-sm">
                      <button onClick={() => { const k = `${entry.surah}:${entry.verse}`; alert(showVerse(entry.surah, entry.verse)) }} className="text-sky-600 underline">{entry.surah}:{entry.verse}</button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ))}

        </div>
      )}

    </div>
  )
}

// End of file
