#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

/**
 * 0) Arabic → Buckwalter converter (inline)
 */
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
  // strip diacritics/ligatures and spaces before mapping
  const clean = str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/ٱ|أ|إ|آ/g, 'ا')
    .replace(/\s+/g, '')
  return clean
    .split('')
    .map(ch => bwMap[ch] || ch)
    .join('')
}

function normalizeArabic(str) {
  return str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/ٱ|أ|إ|آ/g, 'ا')
    .replace(/[^\u0621-\u064A]/g, '')
    .trim()
}

async function main() {
  // 1) Input file paths
  const quranPath = path.resolve('public', 'quran.txt')
  const qacPath   = path.resolve('public', 'quranic-corpus-morphology-0.4.txt')
  const outPath   = path.resolve('public', 'quran-qac.json')

  if (!fs.existsSync(quranPath) || !fs.existsSync(qacPath)) {
    console.error('❌ Missing public/quran.txt or public/quranic-corpus-morphology-0.4.txt')
    process.exit(1)
  }

  // 2) Read & split lines
  const quranLines = fs
    .readFileSync(quranPath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(l => l)

  const qacLinesRaw = fs
    .readFileSync(qacPath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(l => l)

  // skip header line if present (e.g. starts with "sura")
  const startIdx    = qacLinesRaw[0].startsWith('sura') ? 1 : 0
  const corpusLines = qacLinesRaw.slice(startIdx)

  // 3) Build QAC index (key = sura|verse|bwForm)
  const corpusIndex = new Map()

  for (const line of corpusLines) {
    const parts = line.split('\t')
    if (parts.length < 4) continue

    const loc      = parts[0].replace(/[()]/g, '') // e.g. "1:1"
    const bwForm   = parts[1]                     // Buckwalter form
    const posTag   = parts[2]                     // POS tag
    const featsRaw = parts[3]                     // e.g. "POS:NOUN|GENDER:..."
    const [sura, verse] = loc.split(':')
    if (!sura || !verse) continue

    // parse feature string into an object
    const features = {}
    featsRaw.split('|').forEach(chunk => {
      if (!chunk) return
      const [k, ...rest] = chunk.split(':')
      features[k] = rest.length ? rest.join(':') : true
    })

    const key = `${sura}|${verse}|${bwForm}`
    if (!corpusIndex.has(key)) corpusIndex.set(key, [])
    corpusIndex.get(key).push({ pos: posTag, features })
  }

  // 4) Walk through every token in quran.txt
  const merged = []

  for (const line of quranLines) {
    const [sura, verse, text] = line.split('|')
    if (!sura || !verse || !text) continue

    const tokens = text.trim().split(/\s+/)
    tokens.forEach((token, idx) => {
      const bwKey = arabicToBuckwalter(token)
      const key   = `${sura}|${verse}|${bwKey}`
      const hits  = corpusIndex.get(key) || []
      const norm  = normalizeArabic(token)

      if (hits.length) {
        hits.forEach(hit => {
          merged.push({
            sura:       Number(sura),
            verse:      Number(verse),
            index:      idx + 1,
            word:       token,
            word_norm:  norm,
            source:     'qac-corpus',
            qac:        hit
          })
        })
      } else {
        merged.push({
          sura:       Number(sura),
          verse:      Number(verse),
          index:      idx + 1,
          word:       token,
          word_norm:  norm,
          source:     'qac-corpus-missing',
          qac:        null
        })
      }
    })
  }

  // 5) Write out the merged JSON
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8')
  console.log(`✅ Generated public/quran-qac.json with ${merged.length} tokens`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
