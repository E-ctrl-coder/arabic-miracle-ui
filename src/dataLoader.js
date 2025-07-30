// src/dataLoader.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/** Fetch raw QAC text file */
async function fetchQACText() {
  const res = await fetch("/qac.txt");
  console.log("fetchQACText(): status", res.status);
  if (!res.ok) throw new Error(`QAC fetch failed: ${res.status}`);
  const text = await res.text();
  console.log("fetchQACText(): received text length", text.length);
  return text;
}

/** Fetch Nemlar ZIP file as a Blob */
async function fetchNemlarZip() {
  const res = await fetch("/nemlar.zip");
  console.log("fetchNemlarZip(): status", res.status);
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  const blob = await res.blob();
  console.log("fetchNemlarZip(): blob size", blob.size);
  return blob;
}

/**
 * Parse QAC text safely → { entries, rootIndex }
 * Skips any line that doesn’t have exactly 7 tab-separated fields.
 */
function parseQAC(text) {
  const lines = text.split("\n");
  const entries = [];
  const rootIndex = {};

  lines.forEach((ln, idx) => {
    const parts = ln.split("\t");
    if (parts.length !== 7) {
      console.log(`parseQAC: skipping line ${idx + 1} (${parts.length} fields)`);
      return;
    }
    const [verseKey, token, seg, root, pattern, lemma, pos] = parts;
    const [prefix = "", stem = "", suffix = ""] = seg.split("|");

    entries.push({ verseKey, token, prefix, stem, suffix, root, pattern, lemma, pos });

    if (!rootIndex[root]) rootIndex[root] = new Set();
    rootIndex[root].add(verseKey);
  });

  console.log("parseQAC: total entries", entries.length);
  console.log("parseQAC: rootIndex keys sample", Object.keys(rootIndex).slice(0, 5));

  return { entries, rootIndex };
}

/** Parse Nemlar ZIP → array of annotation entries */
async function parseNemlar(blob) {
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "$" });
  const entries = [];

  await Promise.all(
    Object.entries(zip.files).map(async ([filename, file]) => {
      const xmlText = await file.async("text");
      const json = parser.parse(xmlText);
      const sentences = json.FILE?.sentence ?? [];
      const list = Array.isArray(sentences) ? sentences : [sentences];

      list.forEach((sent, si) => {
        const annots = Array.isArray(sent.annotation)
          ? sent.annotation
          : [sent.annotation];

        annots.forEach((a, ai) => {
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

/** Load both corpora */
export async function loadCorpora() {
  const [qacData, nemEntries] = await Promise.all([
    loadQAC(),
    loadNemlar(),
  ]);
  return { ...qacData, nemlarEntries: nemEntries };
}