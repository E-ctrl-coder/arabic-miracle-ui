// src/loader/qacJsonLoader.js

/**
 * Environment-aware path resolver for QAC data
 */
const getQACPath = () => {
  if (import.meta.env.MODE === 'development') {
    return '/qac.json'; // Absolute path for dev server
  }
  return './qac.json'; // Relative path for production
};

/**
 * Load QAC data with multiple fallback strategies
 */
export async function loadQACData() {
  const QAC_PATH = getQACPath();
  console.log(`Attempting to load QAC data from: ${QAC_PATH}`);

  // Strategy 1: Fetch from server
  try {
    const response = await fetch(QAC_PATH, {
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Successfully loaded QAC data via fetch');
    return data;
  } catch (fetchError) {
    console.warn('Fetch failed, trying fallback methods:', fetchError.message);
    
    // Strategy 2: Direct import (works with bundlers)
    try {
      const importedData = await import('../../public/qac.json');
      console.log('Successfully loaded QAC data via direct import');
      return importedData.default;
    } catch (importError) {
      console.error('Direct import failed:', importError.message);
      
      // Strategy 3: Hardcoded fallback (last resort)
      try {
        const hardcodedData = await fetchFallbackData();
        console.warn('Using hardcoded fallback data');
        return hardcodedData;
      } catch (finalError) {
        throw new Error(
          `All data loading methods failed:\n` +
          `1. Fetch: ${fetchError.message}\n` +
          `2. Import: ${importError.message}\n` +
          `3. Fallback: ${finalError.message}`
        );
      }
    }
  }
}

/**
 * Hardcoded fallback data (minimal working example)
 */
async function fetchFallbackData() {
  return [
    {
      "location": "1:1:1",
      "form": "بِسْمِ",
      "lemma": "{som",
      "root": "smw",
      "tag": "N",
      "features": ["M", "GEN"],
      "segments": {
        "prefixes": ["بِ"],
        "stem": "سْمِ",
        "suffixes": []
      }
    }
  ];
}

/**
 * Normalize Arabic text
 */
export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآء]/g, "ا")
    .replace(/[ةئ]/g, "ه")
    .trim();
}

/**
 * Conservative Arabic stemming
 */
export function stemArabic(text) {
  const normalized = normalizeArabic(text);
  return normalized
    .replace(/^[والفبكلس]/, "")
    .replace(/[هي]?$/, "");
}

/**
 * Get surface form with safety checks
 */
export function getSurfaceForm(entry) {
  if (!entry) return "";
  return entry.form || "";
}

// Export all functions
export default {
  loadQACData,
  normalizeArabic,
  stemArabic,
  getSurfaceForm
};
