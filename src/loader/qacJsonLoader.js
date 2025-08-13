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
 * - Removing diacritics
 * - Standardizing character variants
 * - Trimming whitespace
 */
export const normalizeArabic = (text) => {
  if (!text) return '';
  
  return text
    .normalize('NFKD')
    // Remove diacritics and tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // Normalize Alef variants and hamza-on-carriers
    .replace(/[إأآءؤئ]/g, 'ا')
    // Normalize other characters
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    // Remove non-Arabic characters
    .replace(/[^\u0600-\u06FF]/g, '')
    .trim();
};

/**
 * Conservative Arabic stemmer that:
 * - Iteratively removes frequent proclitics and imperfect prefixes
 * - Removes common suffixes
 * - Preserves the core as much as possible
 */
export const stemArabic = (word) => {
  const normalized = normalizeArabic(word);
  if (normalized.length < 3) return normalized;

  let stemmed = normalized;

  // Iteratively strip common leading clitics and imperfect prefixes
  const prefixPatterns = [
    /^(وال|فال|بال|كال)/, // fused clitics + "ال"
    /^ال/,                // definite article
    /^(و|ف|س)/,           // conjunctions/future
    /^(ل|ب|ك)/,           // proclitics
    /^(ي|ت|ن|أ)/          // imperfect verb prefixes (ya-, ta-, na-, ’a-)
  ];

  let prev;
  do {
    prev = stemmed;
    for (const p of prefixPatterns) {
      stemmed = stemmed.replace(p, '');
    }
  } while (stemmed !== prev && stemmed.length > 2);

  // Common Arabic suffixes
  const suffixes = [
    /كما$/, /كم$/, /كن$/, /نا$/, /ني$/, /نا$/, /هم$/, /هن$/, /ها$/, /ه$/, /ك$/,
    /وا$/, /ات$/, /ون$/, /ين$/, /ان$/
  ];

  for (const s of suffixes) {
    const next = stemmed.replace(s, '');
    if (next.length >= 2) stemmed = next;
  }

  return stemmed.length > 1 ? stemmed : normalized;
};

/**
 * Loads and caches QAC data with:
 * - Multiple fallback paths
 * - Data validation
 * - Pre-processing
 */
export const loadQACData = async () => {
  if (cachedData) return cachedData;
  
  let lastError = null;
  
  for (const path of QAC_PATHS) {
    try {
      const response = await fetch(path);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate data structure
      if (!Array.isArray(data)) throw new Error("Data is not an array");
      if (data.length === 0) throw new Error("Empty dataset");
      if (!data[0].location || !data[0].form) throw new Error("Missing required fields");
      
      // Pre-process data
      cachedData = data.map(entry => ({
        ...entry,
        normalizedForm: normalizeArabic(entry.form),
        stem: stemArabic(entry.form),
        sura: entry.location.split(':')[0],
        verse: entry.location.split(':')[1],
        wordNum: entry.location.split(':')[2]
      }));
      
      return cachedData;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to load from ${path}:`, error.message);
    }
  }
  
  throw new Error(`All data loading attempts failed. Last error: ${lastError?.message}`);
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

/**
 * Gets verse text by sura and verse number
 */
export const getVerseText = (sura, verse) => {
  if (!quranTextCache) return "Loading verse...";
  return quranTextCache[`${sura}:${verse}`] || "Verse not found";
};

/**
 * Analyzes a single entry to extract:
 * - Morphological features
 * - Location details
 * - Segments breakdown
 */
export const analyzeEntry = (entry) => {
  if (!entry) return null;
  
  return {
    form: entry.form,
    normalized: entry.normalizedForm || normalizeArabic(entry.form),
    root: entry.root || "N/A",
    lemma: entry.lemma || "N/A",
    tag: entry.tag || "N/A",
    location: entry.location,
    sura: entry.sura,
    verse: entry.verse,
    wordNum: entry.wordNum,
    prefixes: entry.segments?.prefixes || [],
    stem: entry.segments?.stem || "",
    suffixes: entry.segments?.suffixes || []
  };
};

/**
 * Gets verse location details in format:
 * { sura, verse, wordNum }
 */
export const getVerseLocation = (entry) => {
  if (!entry?.location) return { sura: "0", verse: "0", wordNum: "0" };
  
  const [sura, verse, wordNum] = entry.location.split(':');
  return { sura, verse, wordNum };
};

// Export all functions
export default {
  normalizeArabic,
  stemArabic,
  loadQACData,
  analyzeEntry,
  getVerseLocation,
  loadQuranText,
  getVerseText
};
