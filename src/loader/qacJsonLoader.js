// src/loader/qacJsonLoader.js

// Configuration constants
const QAC_PATHS = [
  '/qac.json',
  './qac.json',
  '/public/qac.json',
  'qac.json'
];

// Cache for loaded data
let cachedData = null;
let quranTextCache = null;

/** Normalise Arabic text */
export const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآءؤئ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FF]/g, '')
    .trim();
};

// Common leading clitics, definite article, and imperfect verb prefixes
const prefixPatterns = [
  /^(وال|فال|بال|كال|ولل|فلل|بلل|كلل)/,
  /^(و?ف?ب?ل?ال)/,
  /^ال/,
  /^(وس|فس|وسوف|فسوف)/,
  /^(و?ف?ب?ل?[يتنأ])/,
  /^(و|ف|س|ل|ب|ك)/,
  /^(ي|ت|ن|أ)/
];

/**
 * Exported helper so App.jsx can pre‑strip search terms
 * using same authoritative patterns as stemArabic
 */
export function stripPrefixes(word) {
  let current = normalizeArabic(word);
  let changed;
  do {
    changed = false;
    for (const pattern of prefixPatterns) {
      if (pattern.test(current)) {
        current = current.replace(pattern, '');
        changed = true;
        break;
      }
    }
  } while (changed && current.length > 2);
  return current;
}

/** Conservative Arabic stemmer */
export const stemArabic = (word) => {
  const normalized = normalizeArabic(word);
  if (normalized.length < 3) return normalized;

  let stemmed = normalized;

  // Iteratively strip prefixes
  let prev;
  do {
    prev = stemmed;
    for (const p of prefixPatterns) {
      stemmed = stemmed.replace(p, '');
    }
  } while (stemmed !== prev && stemmed.length > 2);

  // Common Arabic suffixes (deduplicated)
  const suffixes = [
    /كما$/, /كم$/, /كن$/, /نا$/, /ني$/, /هم$/, /هن$/, /ها$/, /ه$/, /ك$/,
    /وا$/, /ات$/, /ون$/, /ين$/, /ان$/
  ];
  for (const s of suffixes) {
    const next = stemmed.replace(s, '');
    if (next.length >= 2) stemmed = next;
  }
  return stemmed.length > 1 ? stemmed : normalized;
};

/**
 * Loads and caches QAC JSON data from known paths
 */
export const loadQACData = async () => {
  if (cachedData) return cachedData;

  for (const path of QAC_PATHS) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        cachedData = await response.json();
        return cachedData;
      }
    } catch (err) {
      console.warn(`Failed to load QAC from ${path}:`, err);
    }
  }
  console.error('Unable to load QAC data from any known path.');
  return [];
};

/**
 * Loads and caches Quran text from quraan.txt
 */
export const loadQuranText = async () => {
  if (quranTextCache) return quranTextCache;

  try {
    const response = await fetch('/quraan.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    quranTextCache = text.trim().split('\n').reduce((acc, line) => {
      const [sura, verse, t] = line.split('|');
      if (sura && verse) {
        acc[`${sura}:${verse}`] = t;
      }
      return acc;
    }, {});

    return quranTextCache;
  } catch (error) {
    console.error("Failed to load Quran text:", error);
    return {};
  }
};

export const getVerseText = (sura, verse) => {
  if (!quranTextCache) return "Loading verse...";
  return quranTextCache[`${sura}:${verse}`] || "Verse not found";
};

/**
 * Analyze a QAC entry, ensuring sura/verse/wordNum are always populated
 */
export const analyzeEntry = (entry) => {
  if (!entry) return null;

  // Fallback: parse sura/verse/wordNum from location if not explicitly present
  let sura = entry.sura;
  let verse = entry.verse;
  let wordNum = entry.wordNum;

  if ((!sura || !verse) && entry.location) {
    const parts = entry.location.split(':');
    if (parts.length >= 2) {
      sura = sura || parts[0];
      verse = verse || parts[1];
      if (parts.length >= 3) wordNum = wordNum || parts[2];
    }
  }

  return {
    form: entry.form,
    normalized: entry.normalizedForm || normalizeArabic(entry.form),
    root: entry.root || "N/A",
    lemma: entry.lemma || "N/A",
    tag: entry.tag || "N/A",
    location: entry.location,
    sura,
    verse,
    wordNum,
    prefixes: entry.segments?.prefixes || [],
    stem: entry.segments?.stem || "",
    suffixes: entry.segments?.suffixes || []
  };
};

export const getVerseLocation = (entry) => {
  if (!entry?.location) return { sura: "0", verse: "0", wordNum: "0" };
  const [sura, verse, wordNum] = entry.location.split(':');
  return { sura, verse, wordNum };
};

export const findStemFamilyOccurrences = (token, allData) => {
  if (!token?.segments?.stem || !Array.isArray(allData)) return [];
  const anchorStem = token.segments.stem;
  return allData.filter(entry =>
    entry.segments?.stem === anchorStem
  );
};

const isMorphDerivative = (candidateStem, anchorStem) => {
  if (!candidateStem || !anchorStem) return false;
  return candidateStem.includes(anchorStem) || anchorStem.includes(candidateStem);
};

export default {
  normalizeArabic,
  stemArabic,
  stripPrefixes,
  loadQACData,
  analyzeEntry,
  getVerseLocation,
  loadQuranText,
  getVerseText,
  findStemFamilyOccurrences
};
