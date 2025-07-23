// scripts/merge-quranic-corpus.js
import fs from 'fs'
import path from 'path'

// 0) Arabic → Buckwalter converter (minimal, inline)
const bwMap = {
  'ا': 'A', 'أ': '>', 'إ': '<', 'آ': '|', 'ء': "'", 'ؤ': '&', 'ئ': '}',
  'ب': 'b', 'ت': 't', 'ث': 'v', 'ج': 'j', 'ح': 'H', 'خ': 'x', 'د': 'd',
  'ذ': '*', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': '$', 'ص': 'S', 'ض': 'D',
  'ط': 'T', 'ظ': 'Z', 'ع': 'E', 'غ': 'g', 'ف': 'f', 'ق': 'q', 'ك': 'k',
  'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'ى': 'Y', 'ة': 'p', 'ٱ': 'A',
  'ً': 'F', 'ٌ': 'N', 'ٍ': 'K', 'َ': 'a', 'ُ': 'u', 'ِ': 'i',
  'ّ': '~', 'ْ': 'o', 'ٰ': '`'
}

function arabicToBuckwalter(str) {
  return str
    .split('')
    .map(ch => bwMap[ch] || ch)
    .join('')
}

function normalizeArabic(str) {
  return str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // harakat, dagger alif, tatwil
    .replace(/ٱ|أ|إ|آ/g, 'ا')                   // unify alifs
    .replace(/[^\u0621-\u064A]/g, '')           // remove punctuation
    .trim()
}

// 1) Paths to your two files in public/
const quranPath = path.resolve('public', 'quran.txt')
const qacPath   = path.resolve('public', 'quranic-corpus-morphology-0.4.txt')

// 2) Read & sanitize lines
const quranLines = fs
  .readFileSync(quranPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim())

const qacLinesRaw = fs
  .readFileSync(qacPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim())

const corpusLines = qacLinesRaw.slice(1)

// 3) Build QAC index: sura|verse|FORM (Buckwalter) → records
const corpusIndex = new Map()

for (const line of corpusLines) {
  const parts = line.split('\t')
  if (parts.length < 4) continue

  const loc      = parts[0]
  const form     = parts[1]
  const tag      = parts[2]
  const featsRaw = parts[3]

  const locParts = loc.replace(/[()]/g, '').split(':')
  if (locParts.length < 2) continue
  const [sura, verse] = locParts

  const features = {}
  featsRaw.split('|').forEach(part => {
    if (!part) return
    const [k, ...rest] = part.split(':')
    const v = rest.join(':') || true
    features[k] = v
  })

  const key = `${sura}|${verse}|${form}`
  if (!corpusIndex.has(key)) corpusIndex.set(key, [])
  corpusIndex.get(key).push({ pos: tag, features })
}

// 4) Walk each Qur’an token → Buckwalter → match
const merged = []

for (const line of quranLines) {
  const [sura, verse, text] = line.split('|')
  if (!sura || !verse || !text) continue

  const tokens = text.trim().split(/\s+/)

  for (const token of tokens) {
    const key = `${sura}|${verse}|${arabicToBuckwalter(token)}`
    const hits = corpusIndex.get(key) || []
    const norm = normalizeArabic(token)

    if (hits.length) {
      hits.forEach(hit =>
        merged.push({
          sura,
          verse,
          word: token,
          word_norm: norm,
          source: 'qac-corpus',
          qac: hit
        })
      )
    } else {
      merged.push({
        sura,
        verse,
        word: token,
        word_norm: norm,
        source: 'qac-corpus-missing',
        qac: null
      })
    }
  }
}

// 5) Output Arabic-enriched JSON
const outPath = path.resolve('public', 'quran-qac.json')
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8')
console.log(`✅ quran-qac.json created with ${merged.length} tokens`)
