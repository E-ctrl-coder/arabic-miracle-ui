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

  return buf.toString('utf8')
}

/**
 * Your original Arabic→Buckwalter map
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

/**
 * Parse a QAC feature string like "STEM|POS:N|LEM:..."
 */
function parseFeatures(featsRaw) {
  const feats = {}
  featsRaw.split('|').forEach(chunk => {
    if (!chunk) return
    const [k, ...rest] = chunk.split(':')
    feats[k] = rest.length ? rest.join(':') : true
  })
  return feats
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

  // 2) Read & filter Quran text
  const quranText = readTextFile(quranPath)
  const quranLines = quranText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l =>
      l !== '' &&
      !l.startsWith('#') &&
      /^\d+\|\d+\|/.test(l)
    )

  console.log('❓ verses read from quran.txt:', quranLines.length)
  if (quranLines.length !== 6236) {
    console.warn(
      `⚠️ Expected 6236 verses but got ${quranLines.length}. ` +
      `Check encoding or stray lines in quran.txt.`
    )
  }

  // Build verse map: "sura|aya" → text
  const verseMap = new Map()
  quranLines.forEach(line => {
    const [sura, aya, text] = line.split('|')
    verseMap.set(`${sura}|${aya}`, text)
  })

  // 3) Read QAC corpus & strip header
  const qacText     = readTextFile(qacPath)
  const qacLinesRaw = qacText.trim().split(/\r?\n/).filter(l => !!l)
  const headerLines = qacLinesRaw[0].startsWith('sura') ? 1 : 0
  const qacLines    = qacLinesRaw.slice(headerLines)

  console.log('❓ morphology lines (minus header):', qacLines.length)

  // 4) Group QAC segments by verse "sura|aya"
  const qacByVerse = new Map()
  for (const line of qacLines) {
    const [locRaw, bwForm, posTag, featsRaw] = line.split('\t')
    if (!locRaw || !bwForm || !posTag) continue

    const [sura, aya, wordIdx, charIdx] = locRaw
      .replace(/[()]/g, '')
      .split(':')
      .map(n => parseInt(n, 10))

    const key = `${sura}|${aya}`
    const seg = {
      wordIdx,
      charIdx,
      bwForm,
      posTag,
      features: parseFeatures(featsRaw)
    }

    if (!qacByVerse.has(key)) qacByVerse.set(key, [])
    qacByVerse.get(key).push(seg)
  }

  // 5) Merge: slice each segment’s surface string from the verse
  const merged = []
  for (const [verseKey, segments] of qacByVerse.entries()) {
    const verseText = verseMap.get(verseKey) || ''
    if (!verseText) {
      console.warn(`⚠️ Verse missing in quran.txt: ${verseKey}`)
      continue
    }

    segments.sort((a, b) => a.charIdx - b.charIdx)

    segments.forEach((seg, i) => {
      const start = seg.charIdx - 1
      const end   = (segments[i + 1]?.charIdx - 1) || verseText.length
      const surface = verseText.slice(start, end).trim()
      const bw = seg.bwForm || arabicToBuckwalter(surface)

      merged.push({
        sura:       Number(verseKey.split('|')[0]),
        aya:        Number(verseKey.split('|')[1]),
        wordIndex:  seg.wordIdx,
        charIndex:  seg.charIdx,
        surface,
        buckwalter: bw,
        pos:        seg.posTag,
        features:   seg.features
      })
    })
  }

  // 6) Write output
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8')
  console.log(`✅ Generated public/quran-qac.json with ${merged.length} segments`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
