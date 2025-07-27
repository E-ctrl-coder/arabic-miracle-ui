// scripts/verify-alignment.js

const fs = require('fs')
const path = require('path')

// Utility to normalize Arabic strings (NFC)
function normalize(str) {
  return str.normalize('NFC').trim()
}

// 1. Load Quran lines into a map: { '1': { '1': '…', '2': '…' } }
const quranRaw = fs.readFileSync(
  path.join(__dirname, '../data/quran.txt'),
  'utf8'
).trim().split('\n')

const quranMap = {}
for (const line of quranRaw) {
  const [sura, aya, text] = line.split('|')
  if (!quranMap[sura]) quranMap[sura] = {}
  quranMap[sura][aya] = normalize(text)
}

// 2. Read QAC morphology lines
const qacRaw = fs.readFileSync(
  path.join(__dirname, '../data/quranic-corpus-morphology-0.4.txt'),
  'utf8'
).trim().split('\n')

// 3. For each QAC line, extract span and compare substring
let failures = 0

for (const line of qacRaw) {
  // Split on tab
  const [keyPart, token] = line.split('\t')
  // keyPart example: (1:1:1:1)
  // Extract sura, aya, and segment indices
  const [sura, aya, , ] = keyPart
    .replace(/[()]/g, '')
    .split(':')

  // Extract start and end from token metadata if available
  // Here we assume the 3rd field in QAC line is the token span
  // Modify this if your format differs
  const spanMatch = line.match(/\)([^\t]+)\t/)
  // If your span is encoded in a separate field, parse it here
  // For now we'll skip span parse and focus on token presence

  const verseText = quranMap[sura]?.[aya] || ''
  const normToken = normalize(token)

  // Simple containment check: token must appear in verse substring
  if (!verseText.includes(normToken)) {
    console.error(
      `✖ Mismatch at ${sura}:${aya} → token “${normToken}” not in verse text:\n  ${verseText}`
    )
    failures++
  }
}

// 4. Report summary
if (failures > 0) {
  console.error(`\nAlignment check failed: ${failures} tokens out of place.`)
  process.exit(1)
} else {
  console.log(`\n✔ All ${qacRaw.length} tokens aligned successfully.`)
  process.exit(0)
}
