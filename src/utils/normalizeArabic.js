export function normalizeArabic(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // remove diacritics
    .replace(/ـ/g, "") // remove tatweel
    .replace(/[إأٱآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .trim();
}

export function stripAffixes(word) {
  if (!word || typeof word !== "string") return "";
  const prefixes = ["ال", "و", "ف", "ب", "ك", "ل", "س"];
  const suffixes = ["ه", "ها", "هم", "هن", "كما", "كم", "نا", "ي", "ة", "ات"];

  let stripped = word;
  prefixes.forEach(p => {
    if (stripped.startsWith(p) && stripped.length > p.length + 2) {
      stripped = stripped.slice(p.length);
    }
  });
  suffixes.forEach(s => {
    if (stripped.endsWith(s) && stripped.length > s.length + 2) {
      stripped = stripped.slice(0, -s.length);
    }
  });
  return stripped;
}
