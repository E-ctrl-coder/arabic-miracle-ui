'use strict';
/**
 * scripts/build-qac.cjs
 * Build public/qac.json from public/qac.txt at word-level.
 */

const fs   = require('fs');
const path = require('path');

// Buckwalter → Arabic map
const BW2AR = {
  "|":"أ","<":"إ","}":"ء","{":"ٱ",
  "A":"ا","b":"ب","t":"ت","T":"ث","j":"ج","H":"ح","x":"خ",
  "d":"د","*":"ذ","r":"ر","z":"ز","s":"س","$":"ش",
  "S":"ص","D":"ض","Z":"ظ","c":"ع","g":"غ","f":"ف","q":"ق",
  "k":"ك","l":"ل","m":"م","n":"ن","h":"ه","w":"و","y":"ي","Y":"ى",
  "a":"َ","u":"ُ","i":"ِ","o":"ْ","~":"ّ"
};

function transliterate(bw) {
  return bw.split('').map(ch => BW2AR[ch] || ch).join('');
}

const inputPath  = path.join(__dirname, '../public/qac.txt');
const outputPath = path.join(__dirname, '../public/qac.json');

// Read and filter lines (skip comments & blank lines)
const lines = fs.readFileSync(inputPath, 'utf8')
  .split(/\r?\n/)
  .filter(l => l.trim() && !l.startsWith('#'));

let seenHeader = false;
const rawEntries = [];

for (const raw of lines) {
  const line = raw.trim();
  if (!seenHeader) {
    if (line === 'LOCATION\tFORM\tTAG\tFEATURES') {
      seenHeader = true;
    }
    continue;
  }
  if (!line.startsWith('(')) continue;

  const cols = line.split('\t');
  if (cols.length < 4) continue;

  const [location, formBW] = cols;
  rawEntries.push({
    location,
    form: transliterate(formBW),
    seg: Number(location.split(':')[3])
  });
}

// Group morphemes into words by sura:ayah:word index
const byWord = rawEntries.reduce((acc, { location, form, seg }) => {
  const [s, a, w] = location.slice(1, -1).split(':').map(Number);
  const key = `${s}:${a}:${w}`;
  (acc[key] || (acc[key] = [])).push({ form, seg });
  return acc;
}, {});

// Build final entries: { location: "sura:ayah", form: "fullWord" }
const entries = Object.entries(byWord).map(([key, segs]) => {
  segs.sort((a, b) => a.seg - b.seg);
  const fullForm = segs.map(x => x.form).join('');
  const [sura, ayah] = key.split(':');
  return { location: `${sura}:${ayah}`, form: fullForm };
});

// Write the JSON
fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
console.log(`✔ Built qac.json with ${entries.length} word entries`);
