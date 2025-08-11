// src/loader/qacJsonLoader.js

const QAC_PATHS = [
  '/qac.json',                // Production path (root)
  './qac.json',               // Relative path
  '/public/qac.json',         // Explicit public path
  'https://analyzer.elbagirdomain.com/qac.json' // Absolute URL
];

// Cache for loaded data
let qacCache = null;

export async function loadQACData() {
  if (qacCache) return qacCache;

  let lastError = null;
  
  for (const path of QAC_PATHS) {
    try {
      console.log(`Attempting to load from: ${path}`);
      const response = await fetch(path, {
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Validate data structure
      if (!Array.isArray(data) throw new Error("Invalid data format");
      if (data.length === 0) throw new Error("Empty dataset");
      if (!data[0].location || !data[0].form) throw new Error("Missing required fields");

      console.log(`Successfully loaded ${data.length} entries from ${path}`);
      
      // Pre-process data
      qacCache = data.map(entry => ({
        ...entry,
        normalizedForm: normalizeArabic(entry.form),
        stem: stemArabic(entry.form),
        sura: entry.location.split(':')[0],
        verse: entry.location.split(':')[1],
        wordNum: entry.location.split(':')[2]
      }));
      
      return qacCache;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to load from ${path}:`, error.message);
    }
  }

  throw new Error(`All loading attempts failed. Last error: ${lastError?.message}`);
}

// Enhanced Arabic normalizer
export function normalizeArabic(text) {
  if (!text) return "";
  
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640\u0610-\u061A]/g, "") // Diacritics
    .replace(/[إأآءؤئ]/g, "ا")  // Normalize Alef variants
    .replace(/[ة]/g, "ه")       // Ta marbuta to ha
    .replace(/[ى]/g, "ي")       // Alif maksura to ya
    .replace(/[^\u0600-\u06FF]/g, "") // Remove non-Arabic
    .trim();
}

// Conservative stemmer
export function stemArabic(word) {
  const normalized = normalizeArabic(word);
  if (normalized.length < 3) return normalized;
  
  // Common Arabic prefixes/suffixes
  return normalized
    .replace(/^(ال|وال|فال|بال|كال|لأ|ل|ب|ك|س|ف|و)/, '')
    .replace(/(ه|ها|هم|هن|كما|كم|نا|ي|ك|وا|ات|ون|ين|ان)$/, '');
}

// Get verse context
export function getVerseLocation(entry) {
  const [sura, verse] = entry.location.split(':');
  return { sura, verse, wordNum: entry.wordNum };
}
