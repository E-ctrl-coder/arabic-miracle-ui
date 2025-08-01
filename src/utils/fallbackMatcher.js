import { normalizeArabic } from "../dataLoader";

export function cleanSurface(word = "") {
  return normalizeArabic(word)
    .replace(/^ال/, "")
    .replace(/^[وفبك]+/, "")
    .replace(/(ه|ها|هم|نا|كم|كن)$/, "")
    .trim();
}
