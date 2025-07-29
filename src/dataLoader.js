// src/dataLoader.js
import JSZip from 'jszip';

// Parse a single QAC line into { surface, tags }
function parseLine(line) {
  // Split on tab: first element is the word, the rest are morphological tags
  const parts = line.split('\t');
  return {
    surface: parts[0],
    tags: parts.slice(1),
  };
}

export async function loadQAC() {
  console.log('[loadQAC] → fetching /qac.txt');
  const res = await fetch('/qac.txt');
  if (!res.ok) {
    console.error('[loadQAC] fetch failed:', res.status);
    return [];
  }

  const raw = await res.text();
  console.log('[loadQAC] raw length:', raw.length);

  // Split into lines, trim whitespace, remove blanks and comment lines
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l !== '' && !l.startsWith('#'));

  console.log('[loadQAC] lines after filter:', lines.length);

  // Map to token objects
  const tokens = lines.map(parseLine);
  console.log('[loadQAC] parsed tokens count:', tokens.length);

  return tokens;
}

export async function loadNemlar() {
  console.log('[loadNemlar] → fetching /nemlar.zip');
  const res = await fetch('/nemlar.zip');
  if (!res.ok) {
    console.error('[loadNemlar] fetch failed:', res.status);
    return [];
  }

  const blob = await res.blob();
  const zip = await JSZip.loadAsync(blob);
  const entries = Object.entries(zip.files);
  console.log('[loadNemlar] zip entries:', entries.map(([name]) => name));

  const docs = await Promise.all(
    entries.map(async ([name, file]) => ({
      name,
      text: await file.async('text'),
    }))
  );
  console.log('[loadNemlar] documents count:', docs.length);

  return docs;
}