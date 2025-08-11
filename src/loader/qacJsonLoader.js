// src/loader/qacJsonLoader.js
let surfaceKey = 'form'; // Directly use 'form' since we know the structure

export async function loadQACData() {
  console.log("Loading QAC data...");
  try {
    const res = await fetch("/public/qac.json");
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    
    const data = await res.json();
    console.log(`QAC data loaded, entries: ${data.length}`);
    return data;
  } catch (err) {
    console.error("Failed to load QAC data:", err);
    return [];
  }
}

// Keep this for backward compatibility
export function getSurface(entry) {
  return entry?.form || "";
}

export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآء]/g, "ا")
    .replace(/[ةئ]/g, "ه")
    .trim();
}

export function stemArabic(text) {
  const normalized = normalizeArabic(text);
  return normalized
    .replace(/^[والفبكلس]/, "")
    .replace(/[هي]?$/, "");
}

// New recommended function
export function getSurfaceForm(entry) {
  return entry?.form || "";
}
