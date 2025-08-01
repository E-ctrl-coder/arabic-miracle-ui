// src/dataLoader.js

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * normalizeArabic(str)
 *
 * • Strips Arabic diacritics & elongation (ṭashkīl), plus Tatwīl (ـ).
 * • Normalizes hamzas, alef variations, tāʾ marbūṭah → standard forms.
 * • Removes any non‑Arabic character (not in Unicode range ء‑ي).
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

// Buckwalter → Arabic character map (for QAC v0.4)
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

// Converts Buckwalter‑encoded string → native Arabic
function buckwalterToArabic(bw = "") {
  return [...bw].map((ch) => BW2AR[ch] ?? ch).join("");
}

// Unified fetch utility supporting .txt (as UTF‑8) and .zip
async function fetchFile(path) {
  const base = process.env.PUBLIC_URL || "";
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  if (path.endsWith(".zip")) return res.blob();
  return res.text().then((t) => t.replace(/^\uFEFF/, ""));
}

/**
 * loadQAC()
 * • Fetches /public/qac.txt
 * • Converts Buckwalter to Arabic
 * • Extracts tokens with morphological features
 * • Builds `entries[]` plus rootIndex: { normRoot: Array<location> }
 */
export async function loadQAC() {
  const text = await fetchFile("/qac.txt");
  const lines = text.split(/\r?\n/);
  const entries = [];
  const rootIndex = {};

  for (const ln of lines) {
    if (!ln || ln.startsWith("#") || ln.startsWith("LOCATION\t")) continue;
    const parts = ln.split("\t");
    if (parts.length < 4) continue;
    const [location, bwForm, , feats] = parts;
    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    let prefix = "", suffix = "", root = "", pattern = "", lemma = "", pos = "";
    for (let i = 0; i < featParts.length; i++) {
      const f = featParts[i];
      if (f === "PREFIX") prefix = buckwalterToArabic(featParts[i + 1] ?? "");
      if (f === "SUFFIX") suffix = buckwalterToArabic(featParts[i + 1] ?? "");
      if (f.startsWith("ROOT:")) root = buckwalterToArabic(f.slice(5));
      if (/^(PAT|PATTERN):/.test(f)) pattern = f.split(":")[1] ?? "";
      if (f.startsWith("LEM:")) lemma = buckwalterToArabic(f.slice(4));
      if (f.startsWith("POS:")) pos = f.slice(4);
    }

    let stem = token;
    if (prefix && stem.startsWith(prefix)) stem = stem.slice(prefix.length);
    if (suffix && stem.endsWith(suffix)) stem = stem.slice(0, stem.length - suffix.length);

    const normToken = normalizeArabic(token);
    const normRoot = normalizeArabic(root);
    if (!normToken) continue;

    entries.push({ location, token, prefix, stem, suffix, root, pattern, lemma, pos, normToken, normRoot });

    if (normRoot) {
      if (!rootIndex[normRoot]) rootIndex[normRoot] = [];
      rootIndex[normRoot].push(location);
    }
  }

  // Sort verse-lists for deterministic display
  Object.keys(rootIndex).forEach((r) => rootIndex[r].sort());

  return { entries, rootIndex };
}

/**
 * loadNemlar()
 * • Fetches /public/nemlar.zip
 * • Parses all XML files via fast-xml-parser
 * • Extracts `<ArabicLexical>` tokens with morphological annotations
 * • Builds:
 *    - tokenIndex: { normToken: Array<entry> }
 *    - rootIndex:  { normRootOrToken: Array<entry> } (fallback for empty root)
 */
export async function loadNemlar() {
  const blob = await fetchFile("/nemlar.zip");
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    textNodeName: "_text"
  });

  const entries = [];
  const xmlFiles = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith(".xml"));

  await Promise.all(
    xmlFiles.map(async (file) => {
      const xmlText = await file.async("string");
      const json = parser.parse(xmlText);
      const sents = json.NEMLAR?.FILE?.sentence ?? [];
      const sentArray = Array.isArray(sents) ? sents : [sents];

      sentArray.forEach((sent) => {
        const sid = sent.id || "";
        const anns = sent.annotation?.ArabicLexical ?? [];
        const annList = Array.isArray(anns) ? anns : [anns];

        annList.forEach((a) => {
          const tok = a.word || "";
          const normToken = normalizeArabic(tok);
          if (!normToken) return;

          entries.push({
            sentenceId: sid,
            filename: file.name,
            token: tok,
            prefix: a.prefix || "",
            stem: "",          // NEMLAR does not include stem
            suffix: a.suffix || "",
            root: a.root || "",
            pattern: a.pattern || "",
            lemma: a.lemma || "",
            pos: a.pos || "",
            normToken
          });
        });
      });
    })
  );

  const tokenIndex = {};
  const rootIndex = {};

  entries.forEach((e) => {
    const tk = normalizeArabic(e.token);
    (tokenIndex[tk] ??= []).push(e);

    const raw = e.root?.trim() ? e.root : e.token;
    const r = normalizeArabic(raw);
    if (!r) return;
    (rootIndex[r] ??= []).push(e);
  });

  return { entries, tokenIndex, rootIndex };
}
