import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * normalizeArabic(str)
 * — removes Arabic diacritics & elongation marks,
 * — unifies alef variants, ta’ marbūṭah, hamzas → standard forms,
 * — strips out any non-Arabic letters (Unicode range ء‑ي).
 *
 * Regex derived from canonical Arabic clean‑up examples, including StackOverflow suggestions:
 * `/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640]/g` removes most non‑spacing marks :contentReference[oaicite:1]{index=1}.
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
  return [...bw].map(ch => BW2AR[ch] ?? ch).join("");
}

const fetchFile = async (path) => {
  const base = process.env.PUBLIC_URL || "";
  const resp = await fetch(base + path);
  if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
  if (path.endsWith(".zip")) return resp.blob();
  return resp.text().then(t => t.replace(/^\uFEFF/, ""));
};

export async function loadQAC() {
  const text = await fetchFile("/qac.txt");
  const lines = text.split(/\r?\n/);
  const entries = [];
  const rootIndex = {};

  for (const ln of lines) {
    if (!ln || ln.startsWith("#") || ln.startsWith("LOCATION\t")) continue;
    const [loc, bwForm, , feats] = ln.split("\t");
    if (!loc || !bwForm) continue;

    const token = buckwalterToArabic(bwForm);
    const featParts = feats.split("|");

    let prefix = "", suffix = "", root = "", pattern = "", lemma = "", pos = "";
    for (let i = 0; i < featParts.length; i++) {
      const f = featParts[i];
      if (f === "PREFIX") prefix = buckwalterToArabic(featParts[i+1] || "");
      if (f === "SUFFIX") suffix = buckwalterToArabic(featParts[i+1] || "");
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

    entries.push({ location: loc, token, prefix, stem, suffix, root, pattern, lemma, pos, normToken, normRoot });
    if (normRoot) rootIndex[normRoot] = rootIndex[normRoot] || [], rootIndex[normRoot].push(loc);
  }

  for (const k in rootIndex) rootIndex[k].sort();
  return { entries, rootIndex };
}

export async function loadNemlar() {
  const blob = await fetchFile("/nemlar.zip");
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", trimValues: true, textNodeName: "_text" });
  const entries = [];

  const xmlFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith(".xml"));
  await Promise.all(xmlFiles.map(async f => {
    const txt = await f.async("string");
    const json = parser.parse(txt);
    const sents = json.NEMLAR?.FILE?.sentence ?? [];
    const list = Array.isArray(sents) ? sents : [sents];

    for (const sent of list) {
      const sid = sent.id || "";
      const anns = sent.annotation?.ArabicLexical ?? [];
      const annList = Array.isArray(anns) ? anns : [anns];

      annList.forEach(a => {
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
    }
  }));

  const tokenIndex = {}, rootIndex = {};
  entries.forEach(e => {
    const key = normalizeArabic(e.token);
    (tokenIndex[key] ??= []).push(e);

    const raw = e.root?.trim() ? e.root : e.token;
    const rkey = normalizeArabic(raw);
    if (!rkey) return;
    (rootIndex[rkey] ??= []).push(e);
  });

  return { entries, tokenIndex, rootIndex };
}
