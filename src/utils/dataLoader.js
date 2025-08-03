// src/utils/dataLoader.js

import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

//─── Helpers & Constants ────────────────────────────────────────────────────//

const BASE = import.meta.env.BASE_URL || './'

// Buckwalter → Arabic map
const buck2arab = {
  "'": 'ء',  "|": 'آ',  ">": 'أ',  "&": 'ؤ', "<": 'إ',
  "}": 'ئ',  "A": 'ا',  b: 'ب',  p: 'ة',  t: 'ت',
  v: 'ث',    j: 'ج',    H: 'ح',  x: 'خ',  d: 'د',
  "*": 'ذ',   r: 'ر',    z: 'ز',  s: 'س',  $: 'ش',
  S: 'ص',    D: 'ض',    T: 'ط',  Z: 'ظ',  E: 'ع',
  g: 'غ',    _: 'ـ',    f: 'ف',  q: 'ق',  k: 'ك',
  l: 'ل',    m: 'م',    n: 'ن',  h: 'ه',  w: 'و',
  Y: 'ى',    y: 'ي',    F: 'ً',  N: 'ٌ',  K: 'ٍ',
  a: 'َ',    u: 'ُ',    i: 'ِ',  "~": 'ّ', o: 'ْ',
  "`": 'ٰ'
}

function buckwalterToArabic(str = '') {
  return str.split('').map(ch => buck2arab[ch] || ch).join('')
}

//─── Gloss Loader for Meanings ───────────────────────────────────────────────//

let _gloss = null

async function loadGloss() {
  if (_gloss === null) {
    try {
      const res = await fetch(`${BASE}gloss.json`)
      _gloss = res.ok ? await res.json() : {}
    } catch {
      _gloss = {}
    }
  }
  return _gloss
}

//─── QAC Loading & Parsing ──────────────────────────────────────────────────//

async function loadQacRaw() {
  const url = `${BASE}qac.txt`
  console.log(`[dataLoader] Loading QAC from ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  return res.text()
}

async function parseQAC(text) {
  const gloss   = await loadGloss()
  const lines   = text.split(/\r?\n/)
  const groups  = {}

  // Group segments by "sura:ayah:wordIndex"
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('LOCATION')) continue

    const [loc, formBW = '', , featStr = ''] = line.split('\t')
    if (!featStr) continue

    const feats  = featStr.split('|')
    const coords = loc.slice(1, -1).split(':') // [sura, ayah, wIdx, segIdx]
    const [sura, ayah, wIdx, segIdx] = coords
    const key    = `${sura}:${ayah}:${wIdx}`
    const idx    = parseInt(segIdx, 10)

    groups[key] = groups[key] || []
    groups[key].push({ idx, formBW, feats, sura, ayah })
  }

  const entries = []

  for (const segs of Object.values(groups)) {
    segs.sort((a, b) => a.idx - b.idx)

    let prefixBW = ''
    let suffixBW = ''
    let stemSeg  = null

    for (const seg of segs) {
      const tag = seg.feats[0]
      if (tag === 'PREFIX') {
        const val = (seg.feats[1] || seg.formBW).replace(/\+$/, '')
        prefixBW += val
      } else if (tag === 'SUFFIX') {
        const val = (seg.feats[1] || seg.formBW).replace(/\+$/, '')
        suffixBW += val
      } else if (seg.feats.includes('STEM')) {
        stemSeg = seg
      }
    }
    if (!stemSeg) continue

    // Clean & map raw features
    const featMap = {}
    for (const f of stemSeg.feats) {
      const [k, v = ''] = f.split(':', 2)
      featMap[k] =
        k === 'LEM' || k === 'PATTERN'
          ? v.replace(/[{}]+/g, '')
          : v
    }

    // Convert to Arabic
    const prefix  = buckwalterToArabic(prefixBW)
    const stem    = buckwalterToArabic(stemSeg.formBW)
    const suffix  = buckwalterToArabic(suffixBW)
    const token   = `${prefix}${stem}${suffix}`
    const root    = buckwalterToArabic(featMap.ROOT    || '')
    const pattern = buckwalterToArabic(featMap.PATTERN || '')
    const lemma   = buckwalterToArabic(featMap.LEM     || '')
    const pos     = featMap.POS || ''

    entries.push({
      sura:      parseInt(stemSeg.sura,  10),
      ayah:      parseInt(stemSeg.ayah,  10),
      token,
      prefix,
      stem,
      suffix,
      root,
      pattern,
      lemma,
      pos,
      features:  featMap,
      meaning:   gloss[root] || gloss[lemma] || ''
    })
  }

  console.log(`[dataLoader] Parsed ${entries.length} QAC entries`)
  return entries
}

//─── NEMLAR Loading & Parsing ───────────────────────────────────────────────//

async function loadNemlarRaw() {
  const url = `${BASE}nemlar.zip`
  console.log(`[dataLoader] Loading NEMLAR from ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  return res.arrayBuffer()
}

async function parseNEMLAR(buffer) {
  const zip       = await JSZip.loadAsync(buffer)
  const parser    = new XMLParser({ ignoreAttributes:true, attributeNamePrefix:'' })
  const sentences = []

  for (const fname of Object.keys(zip.files)) {
    if (!fname.endsWith('.xml')) continue
    const xmlText = await zip.files[fname].async('text')
    const json    = parser.parse(xmlText)
    const file    = json.NEMLAR?.FILE
    if (!file) continue

    const sents = Array.isArray(file.sentence)
      ? file.sentence
      : [file.sentence]

    for (const s of sents) {
      const ann  = s.annotation?.ArabicLexical
      if (!ann) continue
      const lexes = Array.isArray(ann) ? ann : [ann]

      sentences.push({
        sentenceId: s.id,
        text:       s.text?.trim() || '',
        tokens:     lexes.map(l => ({
          token:   l.word    || '',
          lemma:   l.lemma   || '',
          pos:     l.pos     || '',
          prefix:  l.prefix  || '',
          root:    l.root    || '',
          pattern: l.pattern || '',
          suffix:  l.suffix  || ''
        }))
      })
    }
  }

  const totalTokens = sentences.flatMap(s => s.tokens).length
  console.log(
    `[dataLoader] Parsed ${sentences.length} NEMLAR sentences, ${totalTokens} tokens`
  )
  return sentences
}

//─── Normalization & Affix‐Stripping ────────────────────────────────────────//

const DIACRITICS = /[\u064B-\u0652]/g
const TATWEEL    = /[\u0640]/g
const PREFIXES   = ['ال','و','ف','ب','ك','ل','س']
const SUFFIXES   = ['ه','ها','هم','نا','كم','كن','ي','ات','ون','ين','ان','ة','ت']

function normalize(str = '') {
  return str.replace(DIACRITICS, '').replace(TATWEEL, '').trim()
}

function stripAffixes(str = '') {
  let s = normalize(str)
  let changed = true
  while (changed) {
    changed = false
    for (const pre of PREFIXES) {
      if (s.startsWith(pre)) {
        s = s.slice(pre.length)
        changed = true
      }
    }
    for (const suf of SUFFIXES) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length)
        changed = true
      }
    }
  }
  return s
}

//─── Caching & Three‐Step Matching + Frequency/Refs ─────────────────────────//

let _qacCache    = null
let _nemlarCache = null

export async function getMatches(word) {
  if (!_qacCache)    _qacCache    = await parseQAC(await loadQacRaw())
  if (!_nemlarCache) _nemlarCache = await parseNEMLAR(await loadNemlarRaw())

  console.log(`[App] Searching for "${word}"`)
  const nemTokens = _nemlarCache.flatMap(s => s.tokens)

  // Step 1: exact
  let step       = 1
  let qacMatches = _qacCache.filter(e => e.token === word)
  let nemMatches = nemTokens.filter(e => e.token === word)

  // Step 2: normalize
  if (!qacMatches.length && !nemMatches.length) {
    step = 2
    const norm = normalize(word)
    qacMatches = _qacCache.filter(e => normalize(e.token) === norm)
    nemMatches = nemTokens.filter(e => normalize(e.token) === norm)
  }

  // Step 3: strip affixes
  if (!qacMatches.length && !nemMatches.length) {
    step = 3
    const stripped = stripAffixes(word)
    qacMatches = _qacCache.filter(e => stripAffixes(e.token) === stripped)
    nemMatches = nemTokens.filter(e => stripAffixes(e.token) === stripped)
  }

  // Frequency & references
  const tokenCount = qacMatches.length
  const tokenRefs  = Array.from(
    new Set(qacMatches.map(e => `${e.sura}:${e.ayah}`))
  ).sort()

  const rootVal     = qacMatches[0]?.root || ''
  const rootMatches = _qacCache.filter(e => e.root === rootVal)
  const rootCount   = rootMatches.length
  const rootRefs    = Array.from(
    new Set(rootMatches.map(e => `${e.sura}:${e.ayah}`))
  ).sort()

  const result = {
    step,
    qac:        qacMatches,
    nemlar:     nemMatches,
    tokenCount,
    tokenRefs,
    rootCount,
    rootRefs
  }
  console.log('[getMatches]', word, '→', result)
  return result
}