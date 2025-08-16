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

/**
 * Normalizes Arabic text by:
 * - Removing diacritics and tatweel
 * - Standardizing character variants
 * - Trimming whitespace and non-Arabic chars
 */
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
 * using the same authoritative patterns as stemArabic
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

/**
 * Conservative Arabic stemmer:
 * - Iteratively removes frequent proclitics and imperfect prefixes
 * - Removes common suffixes
 * - Preserves the core as much as possible
 */
export const stemArabic = (word) => {
  const normalized = normalizeArabic(word);
  if (normalized.length < 3) return normalized;

  let stemmed = normalized;

  // Iteratively strip common prefixes
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
 * Internal: validate shape and enrich entries with:
 * - normalizedForm (normalized entry.form)
 * - stem (derived via stemArabic; does NOT overwrite segments.stem)
 * - sura, verse, wordNum parsed from location
 * - segments preserved as-is
 */
function validateAndEnrich(raw) {
  if (!Array.isArray(raw)) {
    throw new Error('QAC data is not an array');
  }
  if (raw.length === 0) {
    throw new Error('QAC dataset is empty');
  }
  if (!raw[0].location || !raw[0].form) {
    throw new Error('QAC entries missing required fields (location/form)');
  }

  return raw.map((entry) => {
    const segments = entry.segments || {};
    let sura = entry.sura;
    let verse = entry.verse;
    let wordNum = entry.wordNum;

    if ((!sura || !verse) && entry.location) {
      const parts = String(entry.location).split(':');
      if (parts.length >= 2) {
        sura = sura || parts[0];
        verse = verse || parts[1];
        if (parts.length >= 3) wordNum = wordNum || parts[2];
      }
    }

    return {
      ...entry,
      normalizedForm: entry.normalizedForm || normalizeArabic(entry.form),
      // Provide a derived convenience stem without touching QAC's own segmentation stem
      stem: stemArabic(entry.form),
      segments: { ...segments },
      sura,
      verse,
      wordNum
    };
  });
}

/**
 * Loads and caches QAC data with:
 * - Multiple fallback paths
 * - Data validation
 * - Pre-processing/enrichment
 */
export const loadQACData = async () => {
  if (cachedData) return cachedData;

  let lastError = null;

  for (const path of QAC_PATHS) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const raw = await response.json();
      const enriched = validateAndEnrich(raw);
      cachedData = enriched;
      return cachedData;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to load from ${path}:`, error?.message || error);
    }
  }

  throw new Error(
    `Unable to load QAC data from any known path. Last error: ${lastError?.message || 'unknown'}`
  );
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

    quranTextCache = text
      .trim()
      .split('\n')
      .reduce((acc, line) => {
        const [sura, verse, t] = line.split('|');
        if (sura && verse) {
          acc[`${sura}:${verse}`] = t;
        }
        return acc;
      }, {});

    return quranTextCache;
  } catch (error) {
    console.error('Failed to load Quran text:', error);
    return {};
  }
};

/**
 * Gets verse text by sura and verse number
 */
export const getVerseText = (sura, verse) => {
  if (!quranTextCache) return 'Loading verse...';
  return quranTextCache[`${sura}:${verse}`] || 'Verse not found';
};

/**
 * Analyzes a single entry to extract:
 * - Morphological features
 * - Location details
 * - Segments breakdown
 */
export const analyzeEntry = (entry) => {
  if (!entry) return null;

  // Fallback parse if any location fields are missing
  let sura = entry.sura;
  let verse = entry.verse;
  let wordNum = entry.wordNum;

  if ((!sura || !verse) && entry.location) {
    const parts = String(entry.location).split(':');
    if (parts.length >= 2) {
      sura = sura || parts[0];
      verse = verse || parts[1];
      if (parts.length >= 3) wordNum = wordNum || parts[2];
    }
  }

  return {
    form: entry.form,
    normalized: entry.normalizedForm || normalizeArabic(entry.form),
    root: entry.root || 'N/A',
    lemma: entry.lemma || 'N/A',
    tag: entry.tag || 'N/A',
    location: entry.location,
    sura,
    verse,
    wordNum,
    prefixes: entry.segments?.prefixes || [],
    stem: entry.segments?.stem || '',
    suffixes: entry.segments?.suffixes || []
  };
};

/**
 * Gets verse location details in format:
 * { sura, verse, wordNum }
 */
export const getVerseLocation = (entry) => {
  if (!entry?.location) return { sura: '0', verse: '0', wordNum: '0' };

  const [sura, verse, wordNum] = String(entry.location).split(':');
  return { sura, verse, wordNum };
};

/**
 * Finds all occurrences for a token based on its exact QAC morphological stem.
 * Root is NOT used here. No fallback to derived/stemArabic().
 */
export const findStemFamilyOccurrences = (token, allData) => {
  if (!token?.segments?.stem || !Array.isArray(allData)) return [];

  const anchorStem = token.segments.stem;
  return allData.filter((entry) => entry.segments?.stem === anchorStem);
};

/**
 * Basic derivative check — adjust as needed for your definition of "derivative".
 */
const isMorphDerivative = (candidateStem, anchorStem) => {
  if (!candidateStem || !anchorStem) return false;
  return candidateStem.includes(anchorStem) || anchorStem.includes(candidateStem);
};

// Export all functions
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
