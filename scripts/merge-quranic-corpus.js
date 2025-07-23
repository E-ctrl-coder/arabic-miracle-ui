// scripts/merge-quranic-corpus.js
import fs from 'fs'
import path from 'path'

//
// 1) Paths to your two files in public/
//
const quranPath = path.resolve('public', 'quran.txt')
const qacPath   = path.resolve(
  'public',
  'quranic-corpus-morphology-0.4.txt'
)

//
// 2) Read & sanitize lines
//
const quranLines = fs
  .readFileSync(quranPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim())

const qacLinesRaw = fs
  .readFileSync(qacPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim())

// Drop the header row from the QAC TSV
const corpusLines = qacLinesRaw.slice(1)

//
// 3) Build an index: sura|verse|word → [morphRecords]
//
const corpusIndex = new Map()

for (const line of corpusLines) {
  const parts = line.split('\t')
  // skip if malformed
  if (parts.length < 4) continue

  const loc      = parts[0]
  const form     = parts[1]
  const tag      = parts[2]
  const featsRaw = parts[3]

  // parse sura & verse from "(1:2:3:4)"
  const locParts = loc.replace(/[()]/g, '').split(':')
  if (locParts.length < 2) continue
  const [sura, verse] = locParts

  // parse FEATURES "KEY:VAL|KEY2:VAL2|FLAG"
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

//
// 4) Merge every token in every verse
//
const merged = []

for (const line of quranLines) {
  const [sura, verse, text] = line.split('|')
  if (!sura || !verse || !text) continue

  const tokens = text.trim().split(/\s+/)

  for (const token of tokens) {
    const key  = `${sura}|${verse}|${token}`
    const hits = corpusIndex.get(key) || []

    if (hits.length) {
      hits.forEach(hit =>
        merged.push({
          sura,
          verse,
          word:   token,
          source: 'qac-corpus',
          qac:    hit
        })
      )
    } else {
      merged.push({
        sura,
        verse,
        word:    token,
        source:  'qac-corpus-missing',
        qac:     null
      })
    }
  }
}

//
// 5) Write out the combined JSON
//
const outPath = path.resolve('public', 'quran-qac.json')
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8')

console.log(`✅ quran-qac.json created with ${merged.length} tokens`)
