// src/dataLoader.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Normalize Arabic text by:
 *  - Removing all tashkeel (diacritics) + tatweel (kashida)
 *  - Unifying all alef variants to bare alef
 *  - Converting final alef-maqsura to ya, ta marbuta to heh, hamzas to base letters
 *  - Stripping non-Arabic letters/punctuation
 */
export function normalizeArabic(str = "") {
  return str
    .normalize("NFC")
    // strip tashkeel & tatweel
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640]/g, "")
    // unify alefs
    .replace(/[إأآ]/g, "ا")
    // alef-maqsura → ya
    .replace(/ى/g, "ي")
    // ta marbūṭa → heh
    .replace(/ة/g, "ه")
    // hamza variants → base
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // strip everything outside Arabic block
    .replace(/[^ء-ي]/g, "");
}

/**
 - Buckwalter → Arabic mapping
 - Source: https://corpus.quran.com/buckwalter.html
*/
const BW2AR = {
  "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
  "H": "ح", "x": "خ", "d": "د", "": "ذ", "r": "ر", "z": "ز",
  "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
  "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
  "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
  "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ْ", "o": "ّ", "`": "ٰ"
};

function buckwalterToArabic(bw) {
  return bw.split("").map(ch => BW2AR[ch] || ch).join("");
}

const ARABIC_DIACRITICS = /[\u0617-\u061A\u064B-\u0652]/g;
export function stripDiacritics(text) {
  return text.replace(ARABIC_DIACRITICS, "");
}

async function fetchQACText() {
  const res = await fetch("/qac.txt");
  if (!res.ok) throw new Error(`QAC fetch failed: ${res.status}`);
  return await res.text();
}

async function fetchNemlarZip() {
  const res = await fetch("/nemlar.zip");
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  return await res.blob();
}

/**
 * Parse QAC v0.4 (4-column Buckwalter file)
 * - Builds entries: { location, token, prefix, stem, suffix, root, pattern, lemma, pos, normToken, normRoot }
 * - Builds rootIndex: { [normRoot]: [location,…] }
 */
function parseQAC(text) {
  const lines = text.split("\n");
  const entries = [];
  const rootIndex = {};

  lines.forEach((ln, idx) => {
    if (!ln.trim() || ln.startsWith("#")) return;
    const parts = ln.split("\t");
    if (parts.length !== 4) {
      console.log(`parseQAC: skipping line ${idx + 1} (${parts.length} fields)`);
      return;
    }

    const [location, bwForm, , feats] = parts;
    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    let prefix = "", stem = "", suffix = "", root = "", lemma = "", pos = "", pattern = "";

    featParts.forEach((f, i) => {
      if (f === "PREFIX") {
        prefix = buckwalterToArabic((featParts[i + 1] || "").replace(/\+$/, ""));
      }
      if (f === "SUFFIX") {
        suffix = buckwalterToArabic((featParts[i + 1] || "").replace(/\+$/, ""));
      }
      if (f.startsWith("POS:")) pos = f.split(":")[1];
      if (f.startsWith("LEM:")) lemma = buckwalterToArabic(f.split(":")[1] || "");
      if (f.startsWith("ROOT:")) root = buckwalterToArabic(f.split(":")[1] || "");
      if (f.startsWith("PAT:") || f.startsWith("PATTERN:")) {
        pattern = f.split(":")[1] || "";
      }
    });

    // derive stem
    stem = token;
    if (prefix && stem.startsWith(prefix)) stem = stem.slice(prefix.length);
    if (suffix && stem.endsWith(suffix)) stem = stem.slice(0, stem.length - suffix.length);

    // compute normalized forms
    const normToken = normalizeArabic(token);
    const normRoot = normalizeArabic(root);

    entries.push({
      location, token, prefix, stem, suffix, root, pattern, lemma, pos,
      normToken, normRoot
    });

    if (normRoot) {
      rootIndex[normRoot] = rootIndex[normRoot] || new Set();
      rootIndex[normRoot].add(location);
    }
  });

  // turn sets → sorted arrays
  Object.keys(rootIndex).forEach(r => {
    rootIndex[r] = Array.from(rootIndex[r]).sort();
  });

  console.log("parseQAC: total entries", entries.length);
  return { entries, rootIndex };
}

/** Parse Nemlar ZIP → flat array of annotation objects with normToken */
async function parseNemlar(blob) {
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "$" });
  const entries = [];

  await Promise.all(
    Object.entries(zip.files).map(async ([filename, file]) => {
      const xml = await file.async("text");
      const json = parser.parse(xml);
      const sentences = json.FILE?.sentence ?? [];
      const list = Array.isArray(sentences) ? sentences : [sentences];

      list.forEach(sent => {
        const anns = Array.isArray(sent.annotation) ? sent.annotation : [sent.annotation];
        anns.forEach(a => {
          const token = a._text;
          const normToken = normalizeArabic(token);
          entries.push({
            filename,
            sentenceId: sent.$.id,
            token, prefix: a.$.prefix, stem: a.$.stem,
            suffix: a.$.suffix, root: a.$.root,
            pattern: a.$.pattern, lemma: a.$.lemma,
            pos: a.$.pos, normToken
          });
        });
      });
    })
  );

  console.log("parseNemlar: total entries", entries.length);
  return entries;
}

export async function loadQAC() {
  const text = await fetchQACText();
  return parseQAC(text);
}

export async function loadNemlar() {
  const blob = await fetchNemlarZip();
  return parseNemlar(blob);
}

export async function loadCorpora() {
  const [qacData, nemData] = await Promise.all([loadQAC(), loadNemlar()]);
  return { ...qacData, nemlarEntries: nemData };
}
