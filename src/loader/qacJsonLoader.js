// src/loader/qacJsonLoader.js

const QAC_PATHS = [
  '/qac.json',
  './qac.json',
  '/public/qac.json'
];

const normalizeArabic = (text) => {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآء]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .trim();
};

const stemArabic = (word) => {
  const normalized = normalizeArabic(word);
  return normalized
    .replace(/^[والفبكلس]/, '')
    .replace(/(ه|ها|هم|هن|كما|كم|نا|ي|ك)$/g, '');
};

export const loadQACData = async () => {
  try {
    for (const path of QAC_PATHS) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const data = await response.json();
          return data.map(entry => ({
            ...entry,
            normalizedForm: normalizeArabic(entry.form),
            stem: stemArabic(entry.form)
          }));
        }
      } catch (e) {
        console.warn(`Failed to load from ${path}:`, e.message);
      }
    }
    throw new Error('All data loading attempts failed');
  } catch (error) {
    console.error('Data loading error:', error);
    throw error;
  }
};

export const analyzeWord = (word, data) => {
  const normalized = normalizeArabic(word);
  if (!normalized) return [];

  // Exact match
  let results = data.filter(entry => 
    entry.normalizedForm === normalized
  );

  // Stem match fallback
  if (results.length === 0) {
    const wordStem = stemArabic(normalized);
    results = data.filter(entry => 
      entry.stem === wordStem
    );
  }

  // Remove duplicates
  return results.filter((entry, index, self) =>
    index === self.findIndex(e => 
      e.location === entry.location && 
      e.form === entry.form
    )
  );
};
