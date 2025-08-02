// src/utils/fallbackMatcher.js

import { normalizeArabic } from "../dataLoader";

/**
 * Clean an Arabic word by normalizing it and stripping off
 * common prefixes and suffixes.
 */
export function cleanSurface(word = "") {
  return normalizeArabic(word)
    .replace(/^ال/, "")
    .replace(/^[وفبك]+/, "")
    .replace(/(ه|ها|هم|نا|كم|كن)$/, "")
    .trim();
}

/**
 * Build a mapping from each root to its fallback forms.
 *
 * @param {Array} entries
 *   Your loaded entries (e.g. from loadQAC or loadNemlar).
 *   Each item must have at least:
 *     - entry.root      a string root
 *     - entry.fallback  a string or array of fallback forms
 *
 * @returns {Object<string, Array>}
 *   rootMap where keys are roots and values are arrays of fallbacks.
 */
export function buildRootMap(entries = []) {
  const rootMap = {};
  for (const entry of entries) {
    const { root, fallback } = entry;
    if (!root || fallback == null) continue;
    // ensure array
    const forms = Array.isArray(fallback) ? fallback : [fallback];
    if (!rootMap[root]) rootMap[root] = [];
    rootMap[root].push(...forms);
  }
  return rootMap;
}

/**
 * Given a raw surface form and a previously built rootMap,
 * return all fallback forms for its root.
 *
 * @param {string} raw
 *   The surface form you want to look up.
 * @param {Object<string, Array>} rootMap
 *   The map you built with buildRootMap().
 * @returns {Array}
 *   All fallback forms for that root, or an empty array.
 */
export function fallbackByRoot(raw = "", rootMap = {}) {
  const key = cleanSurface(raw);
  return rootMap[key] || [];
}