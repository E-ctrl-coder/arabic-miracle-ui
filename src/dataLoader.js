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

/** Parse Nemlar ZIP → array of annotation entries */
async function parseNemlar(blob) {
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "$" });
  const entries = [];

  // iterate every file inside the ZIP
  await Promise.all(
    Object.entries(zip.files).map(async ([filename, file]) => {
      const xmlText = await file.async("text");
      const json = parser.parse(xmlText);
      const sentences = json.FILE?.sentence ?? [];
      const list = Array.isArray(sentences) ? sentences : [sentences];

      list.forEach((sent) => {
        // each <sentence> has one or more <annotation> children
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

/** Parse QAC text → entries + build root→verses index */
function parseQAC(text) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const entries = lines.map((ln) => {
    // tab-delimited: verseKey, token, seg, root, pattern, lemma, pos
    const [verseKey, token, seg, root, pattern, lemma, pos] = ln.split("\t");
    const [prefix, stem, suffix] = seg.split("|");
    return { verseKey, token, prefix, stem, suffix, root, pattern, lemma, pos };
  });

  // build an index: root → Set of verseKeys
  const rootIndex = entries.reduce((idx, e) => {
    if (!idx[e.root]) idx[e.root] = new Set();
    idx[e.root].add(e.verseKey);
    return idx;
  }, {});

  return { entries, rootIndex };
}

/** Public: load and parse both corpora */
export async function loadCorpora() {
  const [qacText, nemlarBlob] = await Promise.all([
    fetchQACText(),
    fetchNemlarZip(),
  ]);

  const { entries: qacEntries, rootIndex } = parseQAC(qacText);
  const nemlarEntries = await parseNemlar(nemlarBlob);

  return { qacEntries, rootIndex, nemlarEntries };
}