// src/utils/fallbackMatcher.js

import { normalizeArabic } from "../dataLoader.js";

/**
 * Strip particles, definite article, pronoun suffixes, and diacritics
 * so surface forms and roots align for matching.
 *
 * @param {string} word
 * @returns {string}
 */
export function cleanSurface(word) {
  return normalizeArabic(word)
    // remove definite article
    .replace(/^ال/, "")
    // remove leading particles (و ف ب ل ك)
    .replace(/^[وفبلك]+/, "")
    // remove common pronoun suffixes
    .replace(/(ه|ها|هم|نا|كم|كن)$/, "");
}

/**
 * Build a Map<root, Array<entry>> using normalized roots.
 * Logs each normalized root mapping for diagnostic purposes.
 *
 * @param {Array<object>} nemlarEntries
 * @returns {Map<string, Array<object>>}
 */
export function buildRootMap(nemlarEntries) {
  const map = new Map();
  console.log(
    `🚧 [buildRootMap] Starting Nemlar root map build with ${nemlarEntries.length} entries`
  );

  nemlarEntries.forEach((entry, index) => {
    const rawRoot = entry.root || "";
    const normRoot = cleanSurface(rawRoot);

    console.log(
      `🚧 [buildRootMap] (${index + 1}/${
        nemlarEntries.length
      }) rawRoot='${rawRoot}' → normRoot='${normRoot}' [token='${entry.token}', sentenceId='${entry.sentenceId}', file='${entry.filename}']`
    );

    if (!normRoot) {
      console.log(
        `🚧 [buildRootMap] Skipped entry with empty normRoot (rawRoot='${rawRoot}')`
      );
      return;
    }

    if (!map.has(normRoot)) {
      map.set(normRoot, []);
    }
    map.get(normRoot).push(entry);
  });

  console.log(
    `🚧 [buildRootMap] Completed. Collected ${map.size} distinct normalized roots.`
  );
  return map;
}

/**
 * Fallback: find all Nemlar entries whose normalized root
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

  // Deduplicate on sentenceId + token (or any unique combo)
  const seen = new Set();
  return hits.filter((e) => {
    const key = `${e.sentenceId || ""}-${e.token || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
