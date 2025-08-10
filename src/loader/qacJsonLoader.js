import { normalizeArabic, stripAffixes } from "../utils/normalizeArabic";

export async function loadQACData() {
  const res = await fetch("/qac.json");
  return await res.json();
}

export function searchWordInQAC(input, qacData) {
  if (!input || typeof input !== "string") return [];

  // Step 1: Exact match
  let matches = qacData.filter(entry => entry.word === input);
  if (matches.length > 0) return formatMatches(matches);

  // Step 2: Normalize & match
  const normInput = normalizeArabic(input);
  matches = qacData.filter(entry => {
    if (!entry.word) return false;
    return normalizeArabic(entry.word) === normInput;
  });
  if (matches.length > 0) return formatMatches(matches);

  // Step 3: Strip affixes & match with stems or roots
  const stripped = stripAffixes(normInput);
  matches = qacData.filter(entry => {
    if (!entry.stem && !entry.root) return false;
    const stemNorm = entry.stem ? normalizeArabic(entry.stem) : "";
    const rootNorm = entry.root ? normalizeArabic(entry.root) : "";
    return stemNorm === stripped || rootNorm === stripped;
  });

  return formatMatches(matches);
}

function formatMatches(entries) {
  return entries.map(e => ({
    word: e.word || "",
    root: e.root || "",
    pattern: e.pattern || "",
    pos: e.pos || "",
    meaning: e.english || "",
    occurrences: e.occurrences || []
  }));
}
