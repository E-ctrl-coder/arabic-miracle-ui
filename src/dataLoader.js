// src/dataLoader.js
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/** Fetch raw QAC text file */
async function fetchQACText() {
  const res = await fetch("/qac.txt");
  if (!res.ok) throw new Error(`QAC fetch failed: ${res.status}`);
  return res.text();
}

/** Fetch Nemlar ZIP file as a Blob */
async function fetchNemlarZip() {
  const res = await fetch("/nemlar.zip");
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  return res.blob();
}

/**
 * Parse QAC text safely → { entries, rootIndex }
 * Skips any line that doesn’t have exactly 7 tab-separated fields.
 */
function parseQAC(text) {
  const rawLines = text.split("\n");
  const entries = [];
  const rootIndex = {};

  rawLines.forEach((ln) => {
    const parts = ln.split("\t");
    if (parts.length !== 7) return;             // drop malformed or empty lines

    const [verseKey, token, seg, root, pattern, lemma, pos] = parts;
    const [prefix = "", stem = "", suffix = ""] = seg.split("|");

    entries.push({ verseKey, token, prefix, stem, suffix, root, pattern, lemma, pos });

    if (!rootIndex[root]) rootIndex[root] = new Set();
    rootIndex[root].add(verseKey);
  });

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

      list.forEach((sent) => {
        const annots = Array.isArray(sent.annotation)
          ? sent.annotation
          : [sent.annotation];

        annots.forEach((a) => {
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

  return entries;
}

/** Load & parse only QAC */
export async function loadQAC() {
  const text = await fetchQACText();
  return parseQAC(text);
}

/** Load & parse only Nemlar */
export async function loadNemlar() {
  const blob = await fetchNemlarZip();
  return parseNemlar(blob);
}

/** Load both corpora: QAC entries + rootIndex, Nemlar entries */
export async function loadCorpora() {
  const [qacText, nemlarBlob] = await Promise.all([
    fetchQACText(),
    fetchNemlarZip(),
  ]);

  const { entries: qacEntries, rootIndex } = parseQAC(qacText);
  const nemlarEntries = await parseNemlar(nemlarBlob);

  return { qacEntries, rootIndex, nemlarEntries };
}