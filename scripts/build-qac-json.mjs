// scripts/build-qac-json.mjs — Arabic-native QAC builder (location-aware)

import { readFile, writeFile } from 'node:fs/promises';

// Deterministic Buckwalter-to-Arabic conversion
function buck2arabic(bw) {
  const map = {
    'A': 'ا', 'b': 'ب', 't': 'ت', 'v': 'ث', 'j': 'ج', 'H': 'ح', 'x': 'خ',
    'd': 'د', '*': 'ذ', 'r': 'ر', 'z': 'ز', 's': 'س', '$': 'ش', 'S': 'ص',
    'D': 'ض', 'T': 'ط', 'Z': 'ظ', 'E': 'ع', 'g': 'غ', 'f': 'ف', 'q': 'ق',
    'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن', 'h': 'ه', 'w': 'و', 'y': 'ي',
    'Y': 'ى', 'p': 'ة', 'a': 'َ', 'u': 'ُ', 'i': 'ِ', 'o': 'ْ', '~': 'ّ',
    'F': 'ً', 'N': 'ٌ', 'K': 'ٍ', '<': 'ء', '>': 'أ', '&': 'ؤ', '}': 'إ',
    '{': 'ا', '|': 'آ', '"': 'ئ', "'": 'ʾ', ' ': ' '
  };
  return bw.split('').map(c => map[c] || c).join('');
}

function parseLocation(raw) {
  const s = raw.trim().replace(/[()]/g, '');
  const [surah, ayah, word, segment] = s.split(':').map(x => x.trim());
  return { surah, ayah, word, segment };
}

function parseFeaturesString(featStr) {
  const parts = featStr.split('|');
  const segType = parts[0];
  const kv = {};
  const flags = [];

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const idx = p.indexOf(':');
    if (idx > -1) {
      const k = p.slice(0, idx);
      const v = p.slice(idx + 1);
      kv[k] = v;
    } else {
      flags.push(p);
    }
  }
  return { segType, kv, flags };
}

function classifySegment(segType) {
  if (segType === 'STEM') return 'stem';
  if (segType === 'SUFFIX') return 'suffix';
  return 'prefix';
}

function normalizeTag({ tagCol, posFromKv }) {
  return posFromKv || tagCol || null;
}

function featuresFromStem({ kv, flags }) {
  const out = [];
  for (const f of flags) out.push(f);
  for (const [k, v] of Object.entries(kv)) {
    if (k === 'LEM' || k === 'ROOT' || k === 'POS') continue;
    out.push(`${k}:${v}`);
  }
  return out;
}

async function main() {
  const inPath = 'public/qac.txt';
  const outPath = 'public/qac.json';

  const raw = await readFile(inPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const wordMap = new Map();
  let totalLines = 0, dataLines = 0, skipped = 0, headerSeen = false;

  for (const line of lines) {
    totalLines++;
    if (!line || line.startsWith('#')) continue;
    if (!headerSeen && line.startsWith('LOCATION')) {
      headerSeen = true;
      continue;
    }

    const cols = line.split('\t');
    if (cols.length < 4) { skipped++; continue; }

    const [locRaw, formBw, tagCol, featStr] = cols;
    if (!locRaw || !formBw || !featStr) { skipped++; continue; }
    dataLines++;

    const loc = parseLocation(locRaw);
    const wordKey = `${loc.surah}:${loc.ayah}:${loc.word}`;
    const { segType, kv, flags } = parseFeaturesString(featStr);
    const segmentClass = classifySegment(segType);

    if (!wordMap.has(wordKey)) {
      wordMap.set(wordKey, {
        location: wordKey,
        form: '',
        lemma: null,
        root: null,
        tag: null,
        features: [],
        segments: { prefixes: [], stem: '', suffixes: [] },
      });
    }

    const agg = wordMap.get(wordKey);
    const segmentArabic = buck2arabic(formBw);

    if (segmentClass === 'stem') {
      agg.segments.stem = segmentArabic;
      if (kv['LEM']) agg.lemma = kv['LEM'];
      if (kv['ROOT']) agg.root = kv['ROOT'];
      agg.tag = normalizeTag({ tagCol, posFromKv: kv['POS'] });
      agg.features = featuresFromStem({ kv, flags });
    } else if (segmentClass === 'prefix') {
      agg.segments.prefixes.push(segmentArabic);
    } else {
      agg.segments.suffixes.push(segmentArabic);
    }
  }

  for (const agg of wordMap.values()) {
  const left = agg.segments.prefixes.join('');
  const stem = agg.segments.stem || '';
  const right = agg.segments.suffixes.join('');
  agg.form = buck2arabic(`${left}${stem}${right}`) || buck2arabic(stem);
  
  }

  const outArr = Array.from(wordMap.values());

  outArr.sort((a, b) => {
    const ax = a.location.split(':').map(Number);
    const bx = b.location.split(':').map(Number);
    for (let i = 0; i < 3; i++) {
      if (ax[i] !== bx[i]) return ax[i] - bx[i];
    }
    return 0;
  });

  await writeFile(outPath, JSON.stringify(outArr, null, 2), 'utf8');

  console.log(JSON.stringify({
    summary: {
      totalLines,
      dataLines,
      skipped,
      uniqueWords: outArr.length,
      example: outArr[0] || null
    }
  }, null, 2));
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});