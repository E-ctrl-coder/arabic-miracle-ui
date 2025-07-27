#!/usr/bin/env node
// scripts/merge-quranic-corpus.js

import fs from 'fs';
import path from 'path';

/**
 * Read a text file and auto-decode BOM’d UTF-16LE or UTF-8
 */
function readTextFile(fp) {
  const buf = fs.readFileSync(fp);

  // UTF-16LE BOM: 0xFF 0xFE
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    console.log(`↳ Detected UTF-16LE BOM in ${path.basename(fp)}`);
    return buf.toString('utf16le').replace(/^\uFEFF/, '');
  }

  // UTF-8 BOM: 0xEF 0xBB 0xBF
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    console.log(`↳ Detected UTF-8 BOM in ${path.basename(fp)}`);
    return buf.toString('utf8').replace(/^\uFEFF/, '');
  }

  return buf.toString('utf8');
}

/**
 * Original Arabic → Buckwalter map
 */
const bwMap = {
  'ا':'A','أ':'>','إ':'<','آ':'|','ء':"'",'ؤ':'&','ئ':'}',
  'ب':'b','ت':'t','ث':'v','ج':'j','ح':'H','خ':'x',
  'د':'d','ذ':'*','ر':'r','ز':'z','س':'s','ش':'$',
  'ص':'S','ض':'D','ط':'T','ظ':'Z','ع':'E','غ':'g',
  'ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n',
  'ه':'h','و':'w','ي':'y','ى':'Y','ة':'p','ٱ':'A',
  'ً':'F','ٌ':'N','ٍ':'K','َ':'a','ُ':'u','ِ':'i',
  'ّ':'~','ْ':'o','ٰ':'`'
};

function arabicToBuckwalter(str) {
  const clean = str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/ٱ|أ|إ|آ/g, 'ا')
    .replace(/\s+/g, '');
  return clean
    .split('')
    .map(ch => bwMap[ch] || ch)
    .join('');
}

function normalizeArabic(str) {
  return str
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/ٱ|أ|إ|آ/g, 'ا')
    .replace(/[^\u0621-\u064A]/g, '')
    .trim();
}

/**
 * Parse a QAC feature string like "STEM|POS:N|LEM:..."
 */
function parseFeatures(featsRaw = '') {
  return featsRaw.split('|').reduce((acc, chunk) => {
    if (!chunk) return acc;
    const [k, ...rest] = chunk.split(':');
    acc[k] = rest.length ? rest.join(':') : true;
    return acc;
  }, {});
}

async function main() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const quranPath = path.join(publicDir, 'quran.txt');
  const qacPath   = path.join(publicDir, 'quranic-corpus-morphology-0.4.txt');
  const outPath   = path.join(publicDir, 'quran-qac.json');

  if (!fs.existsSync(quranPath) || !fs.existsSync(qacPath)) {
    console.error('❌ Missing public/quran.txt or public/quranic-corpus-morphology-0.4.txt');
    process.exit(1);
  }

  // 1) Read verses
  const quranText  = readTextFile(quranPath);
  const quranLines = quranText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && /^\d+\|\d+\|/.test(l));

  if (quranLines.length !== 6236) {
    console.warn(`⚠️ Expected 6236 verses, got ${quranLines.length}`);
  }

  const verseMap = new Map();
  quranLines.forEach(line => {
    const [sura, aya, text] = line.split('|');
    verseMap.set(`${sura}|${aya}`, text);
  });

  // 2) Read QAC
  const qacText     = readTextFile(qacPath);
  const rawQacLines = qacText.trim().split(/\r?\n/).filter(Boolean);
  const hasHeader   = rawQacLines[0].startsWith('sura');
  const qacLines    = hasHeader ? rawQacLines.slice(1) : rawQacLines;

  // 3) Group QAC by verse
  const qacByVerse = new Map();
  qacLines.forEach(L => {
    const [locRaw, bwForm, posTag, featsRaw] = L.split('\t');
    if (!locRaw || !bwForm || !posTag) return;

    const [sura, aya, wordIdx, charIdx] = locRaw
      .replace(/[()]/g, '')
      .split(':')
      .map(n => parseInt(n, 10));

    const key = `${sura}|${aya}`;
    const seg = {
      wordIdx,
      charIdx,
      bwForm,
      posTag,
      features: parseFeatures(featsRaw)
    };

    if (!qacByVerse.has(key)) qacByVerse.set(key, []);
    qacByVerse.get(key).push(seg);
  });

  // 4) Merge segments
  const merged = [];
  verseMap.forEach((verseText, verseKey) => {
    const segments = qacByVerse.get(verseKey) || [];
    if (!segments.length) {
      console.warn(`⚠️ No QAC for verse ${verseKey}`);
      return;
    }

    segments.sort((a, b) => a.charIdx - b.charIdx);
    segments.forEach((seg, i) => {
      const start = seg.charIdx - 1;
      const end   = (segments[i + 1]?.charIdx - 1) || verseText.length;
      const surface = verseText.slice(start, end).trim();
      const bw      = seg.bwForm || arabicToBuckwalter(surface);

      merged.push({
        sura:       +verseKey.split('|')[0],
        aya:        +verseKey.split('|')[1],
        wordIndex:  seg.wordIdx,
        charIndex:  seg.charIdx,
        surface,
        buckwalter: bw,
        pos:        seg.posTag,
        features:   seg.features
      });
    });
  });

  // 5) Wrap with metadata and write
  const output = {
    metadata: {
      sourceQuran: path.basename(quranPath),
      sourceQAC:   path.basename(qacPath),
      generatedAt: new Date().toISOString(),
      totalSegments: merged.length
    },
    segments: merged
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✅ Wrote ${merged.length} segments to ${path.relative(process.cwd(), outPath)}`);
}

// invoke
main().catch(err => {
  console.error(err);
  process.exit(1);
});
