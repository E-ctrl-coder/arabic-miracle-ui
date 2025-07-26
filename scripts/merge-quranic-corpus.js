#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

/**
 * Read a text file and auto-decode BOM’d UTF-16LE or UTF-8 (or plain UTF-8)
 */
function readTextFile(fp) {
  const buf = fs.readFileSync(fp)
  // UTF‐16LE BOM: 0xFF 0xFE
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    return buf.toString('utf16le')
  }
  // UTF‐8 BOM: 0xEF 0xBB 0xBF
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.toString('utf8').slice(1)
  }
  // default to UTF-8
  return buf.toString('utf8')
}

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
  // 1) Paths to your source texts and output JSON
  const quranPath = path.resolve('public', 'quran.txt')
  const qacPath   = path.resolve('public', 'quranic-corpus-morphology-0.4.txt')
  const outPath   = path.resolve('public', 'quran-qac.json')

  if (!fs.existsSync(quranPath) || !fs.existsSync(qacPath)) {
    console.error('❌ Missing public/quran.txt or public/quranic-corpus-morphology-0.4.txt')
    process.exit(1)
  }

  // 2) Read & split lines (auto-decode BOM/encoding)
  const quranText  = readTextFile(quranPath)
  const quranLines = quranText.trim().split(/\r?\n/).filter(l => l)
  console.log('❓ verses read from quran.txt:', quranLines.length)

  const qacText     = readTextFile(qacPath)
  const qacLinesRaw = qacText.trim().split(/\r?\n/).filter(l => l)
  const startIdx    = qacLinesRaw[0].startsWith('sura') ? 1 : 0
  const corpusLines = qacLinesRaw.slice(startIdx)
  console.log('❓ morphology lines (minus header):', corpusLines.length)

  // 3) Build QAC index
  const corpusIndex = new Map()
  for (const line of corpusLines) {
    const [locRaw, bwForm, posTag, featsRaw] = line.split('\t')
    if (!locRaw || !bwForm || !posTag) continue

    const loc = locRaw.replace(/[()]/g, '')      // "1:1:2:1"
    const [sura, verse, wordIdx] = loc.split(':')
    if (!sura || !verse || !wordIdx) continue

    const features = {}
    featsRaw.split('|').forEach(chunk => {
      if (!chunk) return
      const [k, ...rest] = chunk.split(':')
      features[k] = rest.length ? rest.join(':') : true
    })

    const key = `${sura}|${verse}|${wordIdx}|${bwForm}`
    if (!corpusIndex.has(key)) corpusIndex.set(key, [])
    corpusIndex.get(key).push({ pos: posTag, features })
  }

  // 4) Merge each verse → tokens → lookup
  const merged = []
  for (const line of quranLines) {
    const [sura, verse, text] = line.split('|')
    if (!sura || !verse || !text) continue

    const tokens = text.trim().split(/\s+/)
    tokens.forEach((token, idx) => {
      const bwKey = arabicToBuckwalter(token)
      const key   = `${sura}|${verse}|${idx + 1}|${bwKey}`
      const hits  = corpusIndex.get(key) || []
      const norm  = normalizeArabic(token)

      if (hits.length) {
        hits.forEach(hit => {
          merged.push({
            sura:      Number(sura),
            verse:     Number(verse),
            index:     idx + 1,
            word:      token,
            word_norm: norm,
            source:    'qac-corpus',
            qac:       hit
          })
        })
      } else {
        merged.push({
          sura:      Number(sura),
          verse:     Number(verse),
          index:     idx + 1,
          word:      token,
          word_norm: norm,
          source:    'qac-corpus-missing',
          qac:       null
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
