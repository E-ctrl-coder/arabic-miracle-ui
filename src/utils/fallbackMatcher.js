import { normalizeArabic } from "../dataLoader.js";

/**
 * Strip definite article, leading particles, pronoun suffixes, and diacritics
 * so surface forms and roots align for matching.
 *
 * @param {string} word
 * @returns {string}
 */
export function cleanSurface(word) {
  return normalizeArabic(word)
    .replace(/^ال/, "")              // remove definite article
    .replace(/^[وفبلك]+/, "")       // remove leading particles
    .replace(/(ه|ها|هم|نا|كم|كن)$/, ""); // remove pronoun suffixes
}

/**
 * Build a Map<normalizedRoot, Array<entry>> at startup.
 *
 * @param {Array<object>} nemlarEntries
 * @returns {Map<string, Array<object>>}
 */
export function buildRootMap(nemlarEntries) {
  const map = new Map();

  nemlarEntries.forEach((entry) => {
    const normRoot = cleanSurface(entry.root || "");
    if (!normRoot) return;

    if (!map.has(normRoot)) {
      map.set(normRoot, []);
    }
    map.get(normRoot).push(entry);
  });

  return map;
}

/**
 * Find all Nemlar entries whose normalized root
 * appears in the cleaned surface form of the input word.
 *
 * @param {string} word
 * @param {Map<string, Array<object>>} rootMap
 * @returns {Array<object>}
 */
export function fallbackByRoot(word, rootMap) {
  const surface = cleanSurface(word);
  const hits = [];

  for (const [root, entries] of rootMap.entries()) {
    if (surface.includes(root)) {
      hits.push(...entries);
    }
  }

  // Deduplicate by sentenceId + token
  const seen = new Set();
  return hits.filter((e) => {
    const key = `${e.sentenceId || ""}-${e.token || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
