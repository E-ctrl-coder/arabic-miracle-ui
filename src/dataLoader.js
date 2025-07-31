// src/dataLoader.js

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Normalize Arabic text by:
 *  - Removing all diacritics (tashkeel + kashida)
 *  - Unifying alef variants (أإآ → ا)
 *  - Converting final-ى → ي, ة → ه, hamzas to base
 *  - Stripping any non-Arabic characters
 */
export function normalizeArabic(str = "") {
  return str
    .normalize("NFC")
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^ء-ي]/g, "");
}

// Buckwalter → Arabic map (QAC v0.4)
const BW2AR = {
  "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  A: "ا", b: "ب", p: "ة", t: "ت", v: "ث", j: "ج",
  H: "ح", x: "خ", d: "د", '"': "ذ", r: "ر", z: "ز",
  s: "س", $: "ش", S: "ص", D: "ض", T: "ط", Z: "ظ",
  E: "ع", g: "غ", f: "ف", q: "ق", k: "ك", l: "ل",
  m: "م", n: "ن", h: "ه", w: "و", Y: "ى", y: "ي",
  F: "ً", N: "ٌ", K: "ٍ", a: "َ", u: "ُ", i: "ِ",
  "~": "ْ", o: "ّ", "`": "ٰ"
};
function buckwalterToArabic(bw) {
  return bw.split("").map(ch => BW2AR[ch] || ch).join("");
}

async function fetchQACText() {
  const res = await fetch("/qac.txt");
  if (!res.ok) throw new Error(`QAC fetch failed: ${res.status}`);
  let txt = await res.text();
  return txt.replace(/^\uFEFF/, "");
}

async function fetchNemlarZip() {
  const res = await fetch("/nemlar.zip");
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  return res.blob();
}

/**
 * Parse QAC v0.4 into { entries, rootIndex }
 */
function parseQAC(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const rootIndex = {};

  // Log first few non-header lines
  const samples = lines
    .filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("LOCATION\t"))
    .slice(0, 5);
  console.log("▶︎ sample QAC lines:", samples);

  lines.forEach((ln, idx) => {
    if (!ln.trim() || ln.startsWith("#")) return;
    if (ln.startsWith("LOCATION\tFORM\tTAG\tFEATURES")) return;

    const parts = ln.split("\t");
    if (parts.length !== 4) {
      console.log(`parseQAC skip line ${idx + 1}: ${parts.length} cols`);
      return;
    }

    const [location, bwForm, , feats] = parts;
    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    let prefix = "", stem = "", suffix = "", root = "";
    let pattern = "", lemma = "", pos = "";

    featParts.forEach((f, i) => {
      if (f === "PREFIX")
        prefix = buckwalterToArabic((featParts[i + 1] || "").replace(/\+$/, ""));
      if (f === "SUFFIX")
        suffix = buckwalterToArabic((featParts[i + 1] || "").replace(/\+$/, ""));
      if (f.startsWith("ROOT:"))
        root = buckwalterToArabic(f.split(":")[1] || "");
      if (f.startsWith("PAT:") || f.startsWith("PATTERN:"))
        pattern = f.split(":")[1] || "";
      if (f.startsWith("LEM:"))
        lemma = buckwalterToArabic(f.split(":")[1] || "");
      if (f.startsWith("POS:"))
        pos = f.split(":")[1] || "";
    });

    stem = token;
    if (prefix && stem.startsWith(prefix))
      stem = stem.slice(prefix.length);
    if (suffix && stem.endsWith(suffix))
      stem = stem.slice(0, stem.length - suffix.length);

    const normToken = normalizeArabic(token);
    const normRoot = normalizeArabic(root);
    if (!normToken) return;

    entries.push({ location, token, prefix, stem, suffix, root, pattern, lemma, pos, normToken, normRoot });

    if (normRoot) {
      rootIndex[normRoot] = rootIndex[normRoot] || new Set();
      rootIndex[normRoot].add(location);
    }
  });

  Object.keys(rootIndex).forEach(r => {
    rootIndex[r] = Array.from(rootIndex[r]).sort();
  });

  console.log("parseQAC: total entries after filter:", entries.length);
  return { entries, rootIndex };
}

/**
 * Parse Nemlar ZIP (XML and/or JSON) into flat array of entries
 * Uses the real path: json.NEMLAR.FILE.sentence
 */
async function parseNemlar(blob) {
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    attributesGroupName: "$",
    textNodeName: "_text"
  });

  const entries = [];
  const files = Object.values(zip.files)
    .filter(f => /\.(xml|json)$/i.test(f.name));

  await Promise.all(files.map(async file => {
    const text = await file.async("string");

    if (file.name.toLowerCase().endsWith(".xml")) {
      const json = parser.parse(text);
      const sents = json.NEMLAR?.FILE?.sentence;
      if (!sents) return;

      const list = Array.isArray(sents) ? sents : [sents];
      list.forEach(sent => {
        const sid = sent.$?.id || "";
        const anns = sent.annotation
          ? Array.isArray(sent.annotation)
            ? sent.annotation
            : [sent.annotation]
          : [];

        anns.forEach(a => {
          const token = a._text || "";
          const norm = normalizeArabic(token);
          if (!norm) return;

          entries.push({
            filename: file.name,
            sentenceId: sid,
            token,
            prefix: a.$?.prefix || "",
            stem: a.$?.stem || "",
            suffix: a.$?.suffix || "",
            root: a.$?.root || "",
            pattern: a.$?.pattern || "",
            lemma: a.$?.lemma || "",
            pos: a.$?.pos || "",
            normToken: norm
          });
        });
      });

    } else {
      // JSON branch
      let docs = [];
      try { docs = JSON.parse(text); }
      catch { return; }

      const arr = Array.isArray(docs) ? docs : [];
      arr.forEach(doc => {
        const id = doc.id || doc.sentenceId || "";
        (doc.tokens || []).forEach(t => {
          const norm = normalizeArabic(t.token || "");
          if (!norm) return;

          entries.push({
            filename: file.name,
            sentenceId: id,
            token: t.token,
            prefix: t.prefix || "",
            stem: t.stem || "",
            suffix: t.suffix || "",
            root: t.root || "",
            pattern: t.pattern || "",
            lemma: t.lemma || "",
            pos: t.pos || "",
            normToken: norm
          });
        });
      });
    }
  }));

  console.log("parseNemlar: total entries after filter:", entries.length);
  return entries;
}

// Public API

export async function loadQAC() {
  const txt = await fetchQACText();
  return parseQAC(txt);
}

export async function loadNemlar() {
  const blob = await fetchNemlarZip();
  return parseNemlar(blob);
}

export async function loadCorpora() {
  const [qacData, nemData] = await Promise.all([loadQAC(), loadNemlar()]);
  return { ...qacData, nemlarEntries: nemData };
}

// Debug helper: expose for console

if (typeof window !== "undefined") {
  window.loadQAC     = loadQAC;
  window.loadNemlar  = loadNemlar;
  window.loadCorpora = loadCorpora;
}
// Expose for debugging in DevTools
if (typeof window !== "undefined") {
  window.JSZip = JSZip;
  window.inspectNemlarZip = async () => {
    const blob = await fetchNemlarZip();
    const zip = await JSZip.loadAsync(blob);
    console.log("ZIP entries →", Object.keys(zip.files));
    return zip;
  };
}
