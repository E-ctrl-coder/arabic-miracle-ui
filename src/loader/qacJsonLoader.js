// src/loader/qacJsonLoader.js
export async function loadQACData() {
  console.log("main.jsx starting...");
  try {
    const res = await fetch("/qac.json");
    console.log(`Fetched qac.json, status: ${res.status}`);
    if (!res.ok) throw new Error(`Failed to load qac.json: ${res.statusText}`);

    const data = await res.json();
    console.log(`QAC data loaded, entries: ${data.length}`);
    return data;
  } catch (err) {
    console.error("Error loading QAC data:", err);
    return [];
  }
}

// Arabic normalization — remove diacritics, tatweel, normalize alif/ya
export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove harakat
    .replace(/\u0640/g, "") // remove tatweel
    .replace(/[إأآ]/g, "ا") // normalize alif forms
    .replace(/ى/g, "ي") // normalize ya
    .trim();
}

// Very basic stemming: remove common prefixes/suffixes
export function stemArabic(text) {
  let t = normalizeArabic(text);
  // Common prefixes
  t = t.replace(/^(ال|و|ف|ب|ك|ل|س)/, "");
  // Common suffixes
  t = t.replace(/(ه|ها|هم|هن|كما|كم|نا|ي|ك)$/g, "");
  return t;
}
