export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآء]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .trim();
}

export function stemArabic(word) {
  const normalized = normalizeArabic(word);
  return normalized
    .replace(/^[والفبكلس]/, "")
    .replace(/(ه|ها|هم|هن|كما|كم|نا|ي|ك)$/g, "");
}

export async function loadQACData() {
  try {
    const response = await fetch('/qac.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to load QAC data:", error);
    return [];
  }
}

export function getVerseLocation(entry) {
  const [sura, verse] = entry.location.split(':');
  return { sura, verse, wordNum: entry.wordNum };
}
