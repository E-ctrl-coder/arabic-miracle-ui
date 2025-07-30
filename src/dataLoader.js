import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Fetch the raw QAC text.
 */
export async function fetchQAC() {
  const res = await fetch("/qac.txt");
  if (!res.ok) throw new Error(`QAC fetch failed: ${res.status}`);
  return await res.text();
}

/**
 * Fetch, unzip, and parse the Nemlar XML files.
 */
export async function fetchNemlar() {
  const res = await fetch("/nemlar.zip");
  if (!res.ok) throw new Error(`Nemlar fetch failed: ${res.status}`);
  const blob = await res.blob();
  const zip = await JSZip.loadAsync(blob);
  const parser = new XMLParser({ ignoreAttributes: false });

  const corpora = {};
  await Promise.all(
    Object.keys(zip.files).map(async (filename) => {
      const text = await zip.files[filename].async("text");
      corpora[filename] = parser.parse(text);
    })
  );
  return corpora;
}

/**
 * Load both corpora in parallel.
 */
export async function loadCorpora() {
  const [qacText, nemlarData] = await Promise.all([
    fetchQAC(),
    fetchNemlar(),
  ]);
  return { qacText, nemlarData };
}