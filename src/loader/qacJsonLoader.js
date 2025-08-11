// src/loader/qacJsonLoader.js
export async function loadQACData() {
  console.log("Loading QAC data...");
  try {
    const res = await fetch("/public/qac.json"); // Explicit path
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    
    const data = await res.json();
    console.log(`QAC data loaded, entries: ${data.length}`);
    return data;
  } catch (err) {
    console.error("Failed to load QAC data:", err);
    return [];
  }
}

// Simplified normalization - preserve essential characters
export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .normalize('NFKD') // Unicode normalization first
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // Remove diacritics and tatweel
    .replace(/[إأآء]/g, "ا") // Normalize alif variants
    .replace(/[ةئ]/g, "ه") // Normalize ta marbuta and hamza
    .trim();
}

// Optional: More conservative stemming
export function stemArabic(text) {
  const normalized = normalizeArabic(text);
  return normalized
    .replace(/^[والفبكلس]/, "") // Common prefixes
    .replace(/[هي]?$/, ""); // Common suffixes
}

// Direct access to known field
export function getSurfaceForm(entry) {
  return entry?.form || "";
}
