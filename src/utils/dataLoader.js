// src/utils/dataLoader.js

const BASE = import.meta.env.BASE_URL || '/';
let _qacCache = null;
let _nemlarCache = null;

// remove all tashkīl (harakāt, shadda, etc.)
const diacRegex = /[\u064B-\u0652\u0653-\u0654\u0670\u0640]/g;

// single-pass affix lists
const prefixes = ['ال','و','ف','ب','ك','ل','س'];
const suffixes = [
  'ه','ها','هم','نا','كم','كن',
  'ي','ات','ون','ين','ان','ة','ت'
];

function stripPrefix(word) {
  for (const p of prefixes) {
    if (word.startsWith(p)) {
      return { prefix: p, stripped: word.slice(p.length) };
    }
  }
  return { prefix: '', stripped: word };
}

function stripSuffix(word) {
  for (const s of suffixes) {
    if (word.endsWith(s)) {
      return { suffix: s, stripped: word.slice(0, -s.length) };
    }
  }
  return { suffix: '', stripped: word };
}

/**
 * Try fetch → json. On any error, fallback to a dynamic JS import.
 */
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Fetch ${path} failed: ${res.status}`);
    return await res.json();
  } catch (fetchErr) {
    try {
      const mod = await import(/* @vite-ignore */ path);
      return mod.default;
    } catch (impErr) {
      console.error('loadJSON failed:', { path, fetchErr, impErr });
      throw new Error(`Cannot load JSON at ${path}`);
    }
  }
}

export async function getMatches(word) {
  // lazy-load corpora once
  if (!_qacCache) {
    _qacCache = await loadJSON(`${BASE}qac.json`);
  }
  if (!_nemlarCache) {
    _nemlarCache = await loadJSON(`${BASE}nemlar.json`);
  }

  let step = 1;
  let qacMatches = _qacCache.filter(e => e.token === word);
  let nemMatches = _nemlarCache.filter(e => e.token === word);

  // step 2: strip diacritics
  if (!qacMatches.length && !nemMatches.length) {
    step = 2;
    const norm = word.replace(diacRegex, '');
    qacMatches = _qacCache.filter(
      e => e.token.replace(diacRegex, '') === norm
    );
    nemMatches = _nemlarCache.filter(
      e => e.token.replace(diacRegex, '') === norm
    );
  }

  // step 3: strip one prefix + one suffix
  let seg = null;
  if (!qacMatches.length && !nemMatches.length) {
    step = 3;
    const norm = word.replace(diacRegex, '');
    const { prefix, stripped: afterPref } = stripPrefix(norm);
    const { suffix, stripped: stem } = stripSuffix(afterPref);
    seg = { prefix, suffix, stem };

    qacMatches = _qacCache.filter(
      e => e.token === stem || e.token.replace(diacRegex, '') === stem
    );
    nemMatches = _nemlarCache.filter(
      e => e.token === stem || e.token.replace(diacRegex, '') === stem
    );
  }

  // counts & verse refs
  const tokenCount = qacMatches.length;
  const tokenRefs = Array.from(
    new Set(qacMatches.map(e => `${e.sura}:${e.ayah}`))
  ).sort();

  const rootVal = qacMatches[0]?.root || '';
  const rootMatches = rootVal 
    ? _qacCache.filter(e => e.root === rootVal)
    : [];
  const rootCount = rootMatches.length;
  const rootRefs = Array.from(
    new Set(rootMatches.map(e => `${e.sura}:${e.ayah}`))
  ).sort();

  // embed segmentation + linguistic fields
  const qac = qacMatches.map(e => ({
    prefix: seg?.prefix || '',
    suffix: seg?.suffix || '',
    stem:   seg?.stem   || e.token,
    pattern:e.pattern   || '',
    root:   e.root      || '',
    lemma:  e.lemma     || '',
    pos:    e.pos       || '',
    sura:   e.sura,
    ayah:   e.ayah
  }));

  const nemlar = nemMatches.map(e => ({
    prefix: seg?.prefix || '',
    suffix: seg?.suffix || '',
    stem:   seg?.stem   || e.token,
    pattern:e.pattern   || '',
    root:   e.root      || '',
    lemma:  e.lemma     || '',
    pos:    e.pos       || '',
    sura:   e.sura,
    ayah:   e.ayah
  }));

  return { step, qac, nemlar, tokenCount, tokenRefs, rootCount, rootRefs };
}