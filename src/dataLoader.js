import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * normalizeArabic(str)
 * • Removes Arabic diacritics (tashkīl, tatwīl),
 * • Normalizes alef variants, yā’, tā marbūṭah, hamzas,
 * • Strips any non-Arabic characters (Unicode range ء‑ي).
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

// Buckwalter → Arabic conversion map for QAC data
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

function buckwalterToArabic(bw = "") {
  return [...bw].map((ch) => BW2AR[ch] ?? ch).join("");
}

async function fetchFile(path) {
  const base = process.env.PUBLIC_URL || "";
  const resp = await fetch(base + path);
  if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
  return path.endsWith(".zip")
    ? resp.blob()
    : resp.text().then((t) => t.replace(/^\uFEFF/, ""));
}

export async function loadQAC() {
  const txt = await fetchFile("/qac.txt");
  const lines = txt.split(/\r?\n/);
  const entries = [];
  const rootIndex = {};

  for (const ln of lines) {
    if (!ln || ln.startsWith("#") || ln.startsWith("LOCATION\t")) continue;
    const parts = ln.split("\t");
    if (parts.length < 4) continue;
    const [location, bwForm, , feats] = parts;
    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    let prefix = "",
      suffix = "",
      root = "",
      pattern = "",
      lemma = "",
      pos = "";

    for (let i = 0; i < featParts.length; i++) {
      const f = featParts[i];
      if (f === "PREFIX") prefix = buckwalterToArabic(featParts[i + 1] || "");
      if (f === "SUFFIX") suffix = buckwalterToArabic(featParts[i + 1] || "");
      if (f.startsWith("ROOT:")) root = buckwalterToArabic(f.slice(5));
      if (/^(PAT|PATTERN):/.test(f)) pattern = f.split(":")[1] || "";
      if (f.startsWith("LEM:")) lemma = buckwalterToArabic(f.slice(4));
      if (f.startsWith("POS:")) pos = f.slice(4);
    }

    let stem = token;
    if (prefix && stem.startsWith(prefix)) stem = stem.slice(prefix.length);
    if (suffix && stem.endsWith(suffix)) stem = stem.slice(0, stem.length - suffix.length);

    const normToken = normalizeArabic(token);
    const normRoot = normalizeArabic(root);
    if (!normToken) continue;

    entries.push({
      location,
      token,
      prefix,
      stem,
      suffix,
      root,
      pattern,
      lemma,
      pos,
      normToken,
      normRoot
    });

    if (normRoot) rootIndex[normRoot] = rootIndex[normRoot] || [], rootIndex[normRoot].push(location);
  }

  for (const k in rootIndex) rootIndex[k].sort();

  return { entries, rootIndex };
}

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
  const xmlfiles = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith(".xml"));

  await Promise.all(
    xmlfiles.map(async (f) => {
      const text = await f.async("string");
      const json = parser.parse(text);
      const sentences = json.NEMLAR?.FILE?.sentence ?? [];
      const sentArray = Array.isArray(sentences) ? sentences : [sentences];

      sentArray.forEach((sent) => {
        const sid = sent.id || "";
        const ann = sent.annotation?.ArabicLexical ?? [];
        const annList = Array.isArray(ann) ? ann : [ann];

        annList.forEach((a) => {
          const tok = a.word || "";
          const normToken = normalizeArabic(tok);
          if (!normToken) return;

          entries.push({
            sentenceId: sid,
            filename: f.name,
            token: tok,
            prefix: a.prefix || "",
            stem: "",
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
    (tokenIndex[e.normToken] ??= []).push(e);
    const raw = e.root?.trim() ? e.root : e.token;
    const r = normalizeArabic(raw);
    if (r) (rootIndex[r] ??= []).push(e);
  });

  return { entries, tokenIndex, rootIndex };
}
