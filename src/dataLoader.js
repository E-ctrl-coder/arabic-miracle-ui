// src/dataLoader.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Buckwalter → Arabic mapping
 * Source: https://corpus.quran.com/buckwalter.html
 */
const BW2AR = {
  "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
  "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
  "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
  "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
  "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
  "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ْ", "o": "ّ", "`": "ٰ"
};

// Convert a Buckwalter string to Arabic script
function buckwalterToArabic(bw) {
  return bw
    .split("")
    .map((ch) => BW2AR[ch] || ch)
    .join("");
}

// Optional: strip diacritics for normalized searches
const ARABIC_DIACRITICS = /[\u0617-\u061A\u064B-\u0652]/g;
export function stripDiacritics(text) {
  return text.replace(ARABIC_DIACRITICS, "");
}

// Fetch raw QAC text
async function fetchQACText() {
  const res = await fetch("/qac.txt");
  console.log("fetchQACText(): status", res.status);
  if (!res.ok) throw new Error(`QAC fetch failed: ${res.status}`);
  const text = await res.text();
  console.log("fetchQACText(): length", text.length);
  return text;
}

// Fetch Nemlar ZIP
async function fetchNemlarZip() {
  const res = await fetch("/nemlar.zip");
  console.log("fetchNemlarZip(): status", res.status);
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  const blob = await res.blob();
  console.log("fetchNemlarZip(): size", blob.size);
  return blob;
}

/**
 * Parse QAC v0.4 (4-column Buckwalter file)
 * Skips header lines starting with '#'. Builds:
 *  - entries: array of { location, token, prefix, stem, suffix, root, pattern, lemma, pos }
 *  - rootIndex: { [root]: [location, …] }
 */
function parseQAC(text) {
  const lines = text.split("\n");
  const entries = [];
  const rootIndex = {};

  lines.forEach((ln, idx) => {
    if (!ln || ln.startsWith("#")) {
      return;
    }
    const parts = ln.split("\t");
    if (parts.length !== 4) {
      console.log(`parseQAC: skipping line ${idx + 1} (${parts.length} fields)`);
      return;
    }

    const [location, bwForm, , feats] = parts;
    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    // Initialize morph slots
    let prefix = "";
    let stem = "";
    let suffix = "";
    let root = "";
    let lemma = "";
    let pos = "";
    let pattern = "";

    // Extract from features
    featParts.forEach((f, i) => {
      if (f === "PREFIX") {
        const p = featParts[i + 1] || "";
        prefix = buckwalterToArabic(p.replace(/\+$/, ""));
      }
      if (f === "SUFFIX") {
        const s = featParts[i + 1] || "";
        suffix = buckwalterToArabic(s.replace(/\+$/, ""));
      }
      if (f.startsWith("POS:")) {
        pos = f.split(":")[1];
      }
      if (f.startsWith("LEM:")) {
        lemma = buckwalterToArabic(f.split(":")[1] || "");
      }
      if (f.startsWith("ROOT:")) {
        root = buckwalterToArabic(f.split(":")[1] || "");
      }
      if (f.startsWith("PAT:") || f.startsWith("PATTERN:")) {
        pattern = f.split(":")[1] || "";
      }
    });

    // Derive stem by stripping prefix & suffix from token
    stem = token;
    if (prefix && stem.startsWith(prefix)) {
      stem = stem.slice(prefix.length);
    }
    if (suffix && stem.endsWith(suffix)) {
      stem = stem.slice(0, stem.length - suffix.length);
    }

    entries.push({ location, token, prefix, stem, suffix, root, pattern, lemma, pos });

    if (root) {
      if (!rootIndex[root]) rootIndex[root] = new Set();
      rootIndex[root].add(location);
    }
  });

  // Convert rootIndex sets → arrays for JSON-friendliness
  Object.keys(rootIndex).forEach((r) => {
    rootIndex[r] = Array.from(rootIndex[r]).sort();
  });

  console.log("parseQAC: total entries", entries.length);
  console.log("parseQAC: rootIndex keys sample", Object.keys(rootIndex).slice(0, 5));

  return { entries, rootIndex };
}

/** Parse Nemlar ZIP → flat array of annotation objects */
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

      list.forEach((sent) => {
        const anns = Array.isArray(sent.annotation) ? sent.annotation : [sent.annotation];
        anns.forEach((a) => {
          entries.push({
            filename,
            sentenceId: sent.$.id,
            token: a._text,
            prefix: a.$.prefix,
            stem: a.$.stem,
            suffix: a.$.suffix,
            root: a.$.root,
            pattern: a.$.pattern,
            lemma: a.$.lemma,
            pos: a.$.pos,
          });
        });
      });
    })
  );

  console.log("parseNemlar: total entries", entries.length);
  return entries;
}

/** Load only QAC */
export async function loadQAC() {
  const text = await fetchQACText();
  return parseQAC(text);
}

/** Load only Nemlar */
export async function loadNemlar() {
  const blob = await fetchNemlarZip();
  return parseNemlar(blob);
}

/** Load both corpora in parallel */
export async function loadCorpora() {
  const [qacData, nemData] = await Promise.all([loadQAC(), loadNemlar()]);
  return { ...qacData, nemlarEntries: nemData };
}