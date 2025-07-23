// scripts/merge-quranic-corpus.js
import fs from 'fs'
import path from 'path'

//
// 1) Paths to your two files in public/data/
//
const quranPath = path.resolve('public/data/quran.txt')
const qacPath   = path.resolve(
  'public/data/quranic-corpus-morphology-0.4.txt'
)

//
// 2) Read and split
//
const quranLines = fs.readFileSync(quranPath, 'utf-8')
  .trim()
  .split('\n')

const qacLines = fs.readFileSync(qacPath, 'utf-8')
  .trim()
  .split('\n')

// drop the header row from the QAC TSV
const [, ...corpusLines] = qacLines

//
// 3) Build an index: sura|verse|word → [morphRecords]
//
const corpusIndex = new Map()

corpusLines.forEach(line => {
  const [loc, form, tag, feats] = line.split('\t')
  const [sura, verse] = loc
    .replace(/[()]/g, '')
    .split(':')
    .slice(0, 2)
  const features = {}
  feats.split('|').forEach(part => {
    const [k, v] = part.split(':')
    features[k] = v || true
  })
  const key = `${sura}|${verse}|${form}`
  if (!corpusIndex.has(key)) corpusIndex.set(key, [])
  corpusIndex.get(key).push({ pos: tag, features })
})

//
// 4) Walk every token in every verse, merge
//
const merged = []

quranLines.forEach(line => {
  const [sura, verse, text] = line.split('|')
  text.trim().split(/\s+/).forEach(token => {
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
  })
})

//
// 5) Write out the combined JSON
//
const outPath = path.resolve('public/data/quran-qac.json')
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf-8')
console.log(`✅ quran-qac.json created with ${merged.length} tokens`)
