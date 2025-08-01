// src/dataLoader.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Normalize Arabic text by:
 *  - Removing diacritics, elongation
 *  - Unifying alef variants, ta marbuta, hamzas
 *  - Removing non-Arabic characters
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
  return (await res.text()).replace(/^\uFEFF/, "");
}

async function fetchNemlarZip() {
  const res = await fetch("/nemlar.zip");
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  return res.blob();
}

/**
 * Parse QAC v0.4 → flat token list + root index
 */
function parseQAC(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const rootIndex = {};

  lines.forEach((line) => {
    if (!line || line.startsWith("#") || line.startsWith("LOCATION\t")) return;
    const parts = line.split("\t");
    if (parts.length !== 4) return;

    const [location, bwForm, , feats] = parts;
    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    let prefix = "", stem = "", suffix = "", root = "", pattern = "", lemma = "", pos = "";

    featParts.forEach((f, i) => {
      if (f === "PREFIX")
        prefix = buckwalterToArabic((featParts[i+1]||"").replace(/\+$/,""));
      if (f === "SUFFIX")
        suffix = buckwalterToArabic((featParts[i+1]||"").replace(/\+$/,""));
      if (f.startsWith("ROOT:"))
        root = buckwalterToArabic(f.split(":")[1]||"");
      if (f.startsWith("PAT:")||f.startsWith("PATTERN:"))
        pattern = f.split(":")[1]||"";
      if (f.startsWith("LEM:"))
        lemma = buckwalterToArabic(f.split(":")[1]||"");
      if (f.startsWith("POS:"))
        pos = f.split(":")[1]||"";
    });

    stem = token;
    if (prefix && stem.startsWith(prefix)) stem = stem.slice(prefix.length);
    if (suffix && stem.endsWith(suffix)) stem = stem.slice(0, stem.length-suffix.length);

    const normToken = normalizeArabic(token);
    const normRoot  = normalizeArabic(root);
    if (!normToken) return;

    entries.push({ location, token, prefix, stem, suffix,
                   root, pattern, lemma, pos,
                   normToken, normRoot });

    if (normRoot) {
      rootIndex[normRoot] = rootIndex[normRoot]||[];
      rootIndex[normRoot].push(location);
    }
  });

  Object.keys(rootIndex).forEach((r) => {
    rootIndex[r].sort();
  });

  return { entries, rootIndex };
}

/**
 * Parse Nemlar ZIP → flat token list from XML
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
  await Promise.all(
    Object.values(zip.files)
      .filter(f => f.name.endsWith(".xml") && !f.dir)
      .map(async file => {
        const text = await file.async("string");
        const json = parser.parse(text);
        const sents = json.NEMLAR?.FILE?.sentence || [];
        const list = Array.isArray(sents) ? sents : [sents];

        list.forEach(sent => {
          const sid = sent.$?.id || "";
          const anns = sent.annotation?.ArabicLexical || [];
          const annList = Array.isArray(anns) ? anns : [anns];

          annList.forEach(a => {
            const tok = a.$?.word || "";
            const norm = normalizeArabic(tok);
            if (!norm) return;
            entries.push({
              sentenceId: sid,
              filename: file.name,
              token: tok,
              prefix: a.$?.prefix || "",
              stem: "",      // not in Nemlar
              suffix: a.$?.suffix || "",
              root: a.$?.root || "",
              pattern: a.$?.pattern || "",
              lemma: a.$?.lemma || "",
              pos: a.$?.pos || "",
              normToken: norm
            });
          });
        });
      })
  );

  return entries;
}

// Public API

export async function loadQAC() {
  const txt = await fetchQACText();
  return parseQAC(txt);
}

export async function loadNemlar() {
  // 1) parse all entries
  const entries = await parseNemlar(await fetchNemlarZip());

  // 2) build exact-token index
  const tokenIndex = {};
  entries.forEach((e) => {
    const key = normalizeArabic(e.token);
    if (!tokenIndex[key]) tokenIndex[key] = [];
    tokenIndex[key].push(e);
  });

  // 3) build root-index (fallback)
  const rootIndex = {};
  entries.forEach((e) => {
    // if root tag is empty, fall back to token
    const raw = e.root && e.root.trim() ? e.root : e.token;
    const key = normalizeArabic(raw);
    if (!key) return;
    if (!rootIndex[key]) rootIndex[key] = [];
    rootIndex[key].push(e);
  });

  return { entries, tokenIndex, rootIndex };
}

export async function loadCorpora() {
  const [qacData, nemData] = await Promise.all([loadQAC(), loadNemlar()]);
  return {
    qacEntries: qacData.entries,
    qacRoots:   qacData.rootIndex,
    nemEntries: nemData.entries,
    nemTokens:  nemData.tokenIndex,
    nemRoots:   nemData.rootIndex
  };
}

// Debug helpers
if (typeof window !== "undefined") {
  window.loadQAC     = loadQAC;
  window.loadNemlar  = loadNemlar;
  window.loadCorpora = loadCorpora;
}
