// Robust QAC data loader with enhanced Arabic processing
const QAC_PATH = import.meta.env.MODE === 'development' ? '/qac.json' : './qac.json';

const ARABIC_NORMALIZATION_MAP = {
  // Combine all Arabic character variants
  'إ': 'ا', 'أ': 'ا', 'آ': 'ا', 'ء': 'ا',
  'ة': 'ه', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي',
  // Diacritics removal
  '\u064B': '', '\u064C': '', '\u064D': '', '\u064E': '', 
  '\u064F': '', '\u0650': '', '\u0651': '', '\u0652': '',
  '\u0670': '', '\u0640': ''
};

export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .split('')
    .map(char => ARABIC_NORMALIZATION_MAP[char] || char)
    .join('')
    .replace(/[^\u0600-\u06FF]/g, "")
    .trim();
}

export function stemArabic(word) {
  const normalized = normalizeArabic(word);
  if (normalized.length < 3) return normalized; // Too short for stemming
  
  // Enhanced prefix/suffix patterns
  const prefixes = [/^و/, /^ف/, /^ب/, /^ك/, /^ل/, /^ال/, /^س/];
  const suffixes = [/ه$/, /ها$/, /هم$/, /هن$/, /كما$/, /كم$/, /نا$/, /ي$/, /ك$/, /وا$/, /ات$/, /ون$/, /ين$/, /ان$/];
  
  let stemmed = normalized;
  prefixes.forEach(pattern => stemmed = stemmed.replace(pattern, ''));
  suffixes.forEach(pattern => stemmed = stemmed.replace(pattern, ''));
  
  return stemmed.length > 1 ? stemmed : normalized; // Fallback to original if stem too short
}

export async function loadQACData() {
  try {
    console.log(`Loading QAC data from: ${QAC_PATH}`);
    const response = await fetch(QAC_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid QAC data format");
    
    // Pre-process data for faster searching
    return data.map(entry => ({
      ...entry,
      normalizedForm: normalizeArabic(entry.form),
      stem: stemArabic(entry.form)
    }));
  } catch (error) {
    console.error("QAC data loading failed:", error);
    return [];
  }
}

export function analyzeEntry(entry) {
  if (!entry) return null;
  return {
    form: entry.form,
    normalized: entry.normalizedForm || normalizeArabic(entry.form),
    root: entry.root || "N/A",
    lemma: entry.lemma || "N/A",
    tag: entry.tag || "N/A",
    location: entry.location,
    prefixes: entry.segments?.prefixes || [],
    suffixes: entry.segments?.suffixes || []
  };
}
