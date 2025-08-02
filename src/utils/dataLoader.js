// src/utils/dataLoader.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * normalizeArabic(str)
 *  – strips diacritics & tatwīl,
 *  – normalizes alef, yā’, tā marbūṭah, hamzas,
 *  – removes non-Arabic chars.
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

/**
 * fetchFile(path)
 *  – always from /data/,
 *  – returns Blob for .zip, text for .txt
 *  – strips BOM from text.
 */
async function fetchFile(path) {
  const url = path.startsWith("/") ? path : `/${path}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return url.endsWith(".zip")
    ? resp.blob()
    : resp.text().then(t => t.replace(/^\uFEFF/, ""));
}

/**
 * loadQAC()
 *  – parses qac.txt into an array of entries,
 *  – also builds tokenIndex & rootIndex maps.
 */
export async function loadQAC() {
  const txt = await fetchFile("/data/qac.txt");
  const lines = txt.split(/\r?\n/);
  const entries = [];
  const tokenIndex = {};
  const rootIndex = {};

  for (const ln of lines) {
    if (!ln || ln.startsWith("#") || ln.startsWith("LOCATION\t")) continue;
    const [location, bw, , feats] = ln.split("\t");
    if (!bw || !feats) continue;

    // Buckwalter → Arabic
    const token = [...bw].map(ch => ({
      "'":"ء","|":"آ",">":"أ","&":"ؤ","<":"إ","}":"ئ",
      A:"ا",b:"ب",p:"ة",t:"ت",v:"ث",j:"ج",
      H:"ح",x:"خ",d:"د",'"':"ذ",r:"ر",z:"ز",
      s:"س",$:"ش",S:"ص",D:"ض",T:"ط",Z:"ظ",
      E:"ع",g:"غ",f:"ف",q:"ق",k:"ك",l:"ل",
      m:"م",n:"ن",h:"ه",w:"و",Y:"ى",y:"ي",
      F:"ً",N:"ٌ",K:"ٍ",a:"َ",u:"ُ",i:"ِ",
      "~":"ْ",o:"ّ","`":"ٰ"
    }[ch] || ch)).join("");

    // extract features
    let [prefix="", suffix="", root="", pattern="", lemma="", pos=""] = [];
    feats.split("|").forEach((f,i,arr) => {
      if (f==="PREFIX")   prefix = arr[i+1]||"";
      if (f==="SUFFIX")   suffix = arr[i+1]||"";
      if (f.startsWith("ROOT:")) root = f.slice(5);
      if (/^(PAT|PATTERN):/.test(f)) pattern = f.split(":")[1]||"";
      if (f.startsWith("LEM:"))   lemma = f.slice(4);
      if (f.startsWith("POS:"))   pos = f.slice(4);
    });

    // derive stem
    let stem = token;
    if (prefix && stem.startsWith(prefix)) stem = stem.slice(prefix.length);
    if (suffix && stem.endsWith(suffix))   stem = stem.slice(0, -suffix.length);

    const normToken = normalizeArabic(token);
    const normRoot  = normalizeArabic(root);
    if (!normToken) continue;

    const entry = { location, token, prefix, stem, suffix, root, pattern, lemma, pos, normToken, normRoot };
    entries.push(entry);
    (tokenIndex[normToken] ||= []).push(entry);
    if (normRoot) (rootIndex[normRoot] ||= []).push(location);
  }

  // sort verse locations
  Object.values(rootIndex).forEach(arr => arr.sort());

  return { entries, tokenIndex, rootIndex };
}

/**
 * loadNemlar()
 *  – fetches nemlar.zip, unzips all XMLs,
 *  – parses each XML with fast-xml-parser,
 *  – returns { entries, tokenIndex, rootIndex }.
 */
export async function loadNemlar() {
  const blob = await fetchFile("/data/nemlar.zip");
  const zip  = await JSZip.loadAsync(blob);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    textNodeName: "_text"
  });

  const entries = [];
  const tokenIndex = {};
  const rootIndex  = {};

  const xmlFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith(".xml"));
  await Promise.all(xmlFiles.map(async f => {
    const xmlText = await f.async("string");
    const json    = parser.parse(xmlText);
    const sents   = json.NEMLAR?.FILE?.sentence ?? [];
    const arr     = Array.isArray(sents) ? sents : [sents];

    arr.forEach(sent => {
      const sid = sent.id || "";
      const ann = Array.isArray(sent.annotation?.ArabicLexical)
        ? sent.annotation.ArabicLexical
        : [sent.annotation?.ArabicLexical].filter(Boolean);

      ann.forEach(a => {
        const tok = a.word || "";
        const normToken = normalizeArabic(tok);
        if (!normToken) return;

        const entry = {
          sentenceId: sid,
          filename:   f.name,
          token:      tok,
          prefix:     a.prefix || "",
          stem:       a.stem   || "",
          suffix:     a.suffix  || "",
          root:       a.root   || "",
          pattern:    a.pattern|| "",
          lemma:      a.lemma  || "",
          pos:        a.pos    || "",
          normToken
        };
        entries.push(entry);
        (tokenIndex[normToken] ||= []).push(entry);

        const r = normalizeArabic(a.root || tok);
        if (r) (rootIndex[r] ||= []).push(entry);
      });
    });
  }));

  return { entries, tokenIndex, rootIndex };
}