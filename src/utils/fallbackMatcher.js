// src/utils/fallbackMatcher.js

/**
 * Strip common prefixes, suffixes, diacritics, and "ال"
 * so surface forms from both sides align better.
 */
export function cleanSurface(word) {
  return word
    .replace(/^ال/, '')                // strip definite article
    .replace(/^[وفبلك]+/, '')         // strip leading particles (و ف ب ل ك)
    .replace(/(ه|ها|هم|نا|كم|كن)$/, '')// strip common pronoun suffixes
    .replace(/[\u064B-\u0652]/g, '')   // strip diacritics
}

/**
 * Build a Map<root, [nemlarEntries]> at startup
 */
export function buildRootMap(nemlarEntries) {
  const map = new Map();
  nemlarEntries.forEach(entry => {
    const root = entry.root;          // assumes entry.root is Arabic string
    if (!map.has(root)) map.set(root, []);
    map.get(root).push(entry);
  });
  return map;
}

/**
 * Try to find any Nemlar entries whose root appears in the cleaned word.
 * Returns [] if none match.
 */
export function fallbackByRoot(word, rootMap) {
  const cleaned = cleanSurface(word);
  for (const [root, entries] of rootMap.entries()) {
    if (cleaned.includes(root)) {
      return entries;
    }
  }
  return [];
}
