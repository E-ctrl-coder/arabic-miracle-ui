// check-input-match.mjs — Arabic input diagnostics against qac.json

import fs from 'fs'

// Load Arabic-native qac.json (array format)
const qacArr = JSON.parse(fs.readFileSync('public/qac.json', 'utf8'))

// Extract keys and build index
const allForms = new Set()
const formMap = {}
for (const item of qacArr) {
  allForms.add(item.form)
  formMap[item.form] = item
}

// Normalize Arabic by stripping Tatweel, ZWNJ, and decomposed diacritics
function normalize(ar) {
  return ar.normalize('NFKC')
           .replace(/[\u0640\u200C]/g, '')      // Tatweel, ZWNJ
           .replace(/[\u064B-\u065F]/g, '')     // All harakat
}

// Input from command line or edit below:
const input = process.argv[2] || 'بسم'
const normInput = normalize(input)

const found = allForms.has(normInput)
console.log(`🔍 Raw Input: ${input}`)
console.log(`🧼 Normalized: ${normInput}`)

if (found) {
  console.log('✅ Found match in qac.json!')
  console.log(JSON.stringify(formMap[normInput], null, 2))
} else {
  // Show partial matches
  const partials = [...allForms].filter(f => normalize(f).includes(normInput))
  console.log('❌ No direct match. Checking near matches...')
  if (partials.length) {
    console.log(`📎 Found ${partials.length} possible fuzzy matches:`)
    partials.slice(0, 5).forEach(p => console.log(`- ${p}`))
  } else {
    console.log('🕳️ No partial matches either.')
  }
}