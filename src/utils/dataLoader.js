import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const buck2arab = {
  "'": 'ء',  "|": 'آ',  ">": 'أ',  "&": 'ؤ',  "<": 'إ',
  "}": 'ئ',  "A": 'ا',  b: 'ب',  p: 'ة',  t: 'ت',
  v: 'ث',    j: 'ج',    H: 'ح',  x: 'خ',  d: 'د',
  "*": 'ذ',  r: 'ر',    z: 'ز',  s: 'س',  $: 'ش',
  S: 'ص',    D: 'ض',    T: 'ط',  Z: 'ظ',  E: 'ع',
  g: 'غ',    _: 'ـ',    f: 'ف',  q: 'ق',  k: 'ك',
  l: 'ل',    m: 'م',    n: 'ن',  h: 'ه',  w: 'و',
  Y: 'ى',    y: 'ي',    F: 'ً',  N: 'ٌ',  K: 'ٍ',
  a: 'َ',    u: 'ُ',    i: 'ِ',  "~": 'ّ',  o: 'ْ',
  "`": 'ٰ'
};

function buckwalterToArabic(str = '') {
  return str.split('').map(ch => buck2arab[ch] || ch).join('');
}

function parseQAC(text) {
  const entries = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const [bwToken, featStr] = parts;
    if (!bwToken || !featStr.includes('|')) continue;

    const [
      prefBW,
      stemBW,
      suffBW,
      rootBW,
      pattBW,
      lemBW,
      posBW
    ] = featStr
      .split('|')
      .map(f => f.replace(/[{}]+/g, '').trim());

    entries.push({
      token:   buckwalterToArabic(bwToken),
      prefix:  buckwalterToArabic(prefBW),
      stem:    buckwalterToArabic(stemBW),
      suffix:  buckwalterToArabic(suffBW),
      root:    buckwalterToArabic(rootBW),
      pattern: buckwalterToArabic(pattBW),
      lemma:   buckwalterToArabic(lemBW),
      pos:     posBW
    });
  }

  return entries;
}

async function parseNEMLAR(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });
  const sentences = [];

  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.endsWith('.xml')) continue;

    const xmlText = await zip.files[fileName].async('text');
    const json = parser.parse(xmlText);
    const file = json.NEMLAR?.FILE;
    if (!file) continue;

    const sents = Array.isArray(file.sentence)
      ? file.sentence
      : [file.sentence];

    for (const s of sents) {
      const ann = s.annotation?.ArabicLexical;
      if (!ann) continue;

      const lexes = Array.isArray(ann) ? ann : [ann];
      sentences.push({
        sentenceId: s.id,
        text:       s.text?.trim() || '',
        tokens:     lexes.map(l => ({
          token:   l.word    || '',
          lemma:   l.lemma   || '',
          pos:     l.pos     || '',
          prefix:  l.prefix  || '',
          root:    l.root    || '',
          pattern: l.pattern || '',
          suffix:  l.suffix  || ''
        }))
      });
    }
  }

  return sentences;
}

export async function loadQacEntries() {
  const res = await fetch('/qac.txt');
  if (!res.ok) throw new Error('Failed to fetch qac.txt');
  const text = await res.text();
  return parseQAC(text);
}

export async function loadNemlarSentences() {
  const res = await fetch('/nemlar.zip');
  if (!res.ok) throw new Error('Failed to fetch nemlar.zip');
  const buf = await res.arrayBuffer();
  return parseNEMLAR(buf);
}

// ----------------- ANALYZER FUNCTIONS -----------------

// Arabic diacritics range U+064B .. U+0652
const DIACRITICS = /[\u064B-\u0652]/g;

// Strip diacritics and whitespace
function normalize(str = '') {
  return str.replace(DIACRITICS, '').trim();
}

/**
 * Build a lookup map: normalizedToken → array of QAC entries
 */
export function buildQacMap(qacEntries) {
  const map = new Map();
  for (const e of qacEntries) {
    const key = normalize(e.token);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}

/**
 * Segment input into the longest matching QAC tokens.
 * Returns an array of { segment, entries }.
 */
export function analyzeWord(input, qacEntries) {
  const qacMap = buildQacMap(qacEntries);
  const normInput = normalize(input);
  const results = [];
  let pos = 0;

  while (pos < normInput.length) {
    let matchLen = 0;
    let matchKey = null;

    for (let len = normInput.length - pos; len > 0; len--) {
      const sub = normInput.substr(pos, len);
      if (qacMap.has(sub)) {
        matchLen = len;
        matchKey = sub;
        break;
      }
    }

    if (!matchKey) {
      results.push({ segment: normInput[pos], entries: [] });
      pos += 1;
    } else {
      results.push({ segment: matchKey, entries: qacMap.get(matchKey) });
      pos += matchLen;
    }
  }

  return results;
}