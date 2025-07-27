// scripts/verify-qac.js
const fs = require('fs');
const path = require('path');

// Adjust these paths if your JSON lives elsewhere
const jsonPath = path.resolve(__dirname, '../public/quran-qac.json');
const txtPath  = path.resolve(__dirname, '../data/quran-corpus-morphology-0.4.txt');

// Load JSON segments
const segments = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Loaded ${segments.length} segments from ${jsonPath}`);

// Count non-empty, non-comment lines in the original QAC txt
const txtLines = fs.readFileSync(txtPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.startsWith('#'));
console.log(`Original QAC lines (ignoring #comments): ${txtLines.length}`);

// Compare counts
if (segments.length !== txtLines.length) {
  console.error(`✘ Mismatch: JSON has ${segments.length}, TXT has ${txtLines.length}`);
  process.exit(1);
}

console.log('✔ verify-qac: counts match, build can proceed.');
