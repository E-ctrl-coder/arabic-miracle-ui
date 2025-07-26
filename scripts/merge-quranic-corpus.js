#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

/**
 * Read a text file and auto-decode BOM’d UTF-16LE or UTF-8
 */
function readTextFile(fp) {
  const buf = fs.readFileSync(fp)
  // UTF-16LE BOM: 0xFF 0xFE
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    console.log(`↳ Detected UTF-16LE BOM in ${path.basename(fp)}`)
    return buf.toString('utf16le').replace(/^\uFEFF/, '')
  }
  // UTF-8 BOM: 0xEF 0xBB 0xBF
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    console.log(`↳ Detected UTF-8 BOM in ${path.basename(fp)}`)
    return buf.toString('utf8').replace(/^\uFEFF/, '')
  }
  // default to UTF-8
  return buf.toString('utf8')
}

/**
 * 0) Arabic → Buckwalter converter (inline)
 */
const bwMap = {
  'ا': 'A', 'أ': '>', 'إ': '<', 'آ': '|', 'ء': "'", 'ؤ': '&', 'ئ': '}',
  'ب': 'b', 'ت': 't', 'ث': 'v', 'ج': 'j', 'ح': 'H', 'خ': 'x',
  'د': 'd', 'ذ': '*', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': '$',
  'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'E', 'غ': 'g',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'Y', 'ة': 'p', 'ٱ': 'A',
  'ً': 'F', 'ٌ': 'N', 'ٍ': 'K', 'َ': 'a', 'ُ': 'u', 'ِ': 'i',
  'ّ': '~', 'ْ': 'o', 'ٰ': '`'
}

function arabicToBuckwalter(str) {
  const clean = str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/ٱ|أ|إ|آ/g, 'ا')
    .replace(/\s+/g, '')
  return clean.split('').map(ch => bwMap[ch] || ch).join('')
}

function normalizeArabic(str) {
  return str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/ٱ|أ|إ|آ/g, 'ا')
    .replace(/[^\u0621-\u064A]/g, '')
    .trim()
}

async function main() {
  // 1) Paths
  const publicDir = path.resolve(process.cwd(), 'public')
  const quranPath = path.join(publicDir, 'quran.txt')
  const qacPath   = path.join(publicDir, 'quranic-corpus-morphology-0.4.txt')
  const outPath   = path.join(publicDir, 'quran-qac.json')

  if (!fs.existsSync(quranPath) || !fs.existsSync(qacPath)) {
    console.error('❌ Missing public/quran.txt or public/quranic-corpus-morphology-0.4.txt')
    process.exit(1)
  }

  // 2) Read & split lines
  const quranText  = readTextFile(quranPath)
  const quranLines = quranText
    .trim()
    .split(/\r?\n/)
    .filter(l => !!l)

  console.log('❓ verses read from quran.txt:', quranLines.length)
  if (quranLines.length !== 6236) {
    console.warn(
      `⚠️ Expected 6236 verses but got ${quranLines.length}. ` +
      `Check encoding or line endings in quran.txt.`
    )
  }

  const qacText     = readTextFile(qacPath)
  const qacLinesRaw = qacText.trim().split(/\r?\n/).filter(l => !!l)
  const headerLines = qacLinesRaw[0].startsWith('sura') ? 1 : 0
  const corpusLines = qacLinesRaw.slice(headerLines)
  console.log('❓ morphology lines (minus header):', corpusLines.length)

  // 3) Build QAC index
  const corpusIndex = new Map()
  for (const line of corpusLines) {
    const [locRaw, bwForm, posTag, featsRaw] = line.split('\t')
    if (!locRaw || !bwForm || !posTag) continue

    // locRaw is "sura:verse:wordIdx:charIdx" — we only need sura:verse:wordIdx
    const loc = locRaw.replace(/[()]/g, '')                
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

  // 4) Merge: map each Quran token to its QAC entries
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
        console.warn(`⚠️ Missing QAC entry for ${sura}:${verse} token #${idx + 1} (“${token}”)`)
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
