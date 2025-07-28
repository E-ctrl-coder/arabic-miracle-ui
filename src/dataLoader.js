// src/dataLoader.js
import JSZip from 'jszip';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// 1) Load QAC from public/qac.txt
export async function loadQAC() {
  const res  = await fetch('/qac.txt');
  if (!res.ok) {
    throw new Error(`Failed to fetch /qac.txt (${res.status})`);
  }
  const text = await res.text();
  const dict = {};
  text.trim().split('\n').forEach(line => {
    const [word, analysis] = line.split('\t');
    dict[word] = dict[word] || [];
    dict[word].push(analysis);
  });
  return dict;
}

// 2) Load Nemlar from API ZIP
export async function loadNemlar() {
  const res  = await fetch(`${API_BASE}/data/nemlar.zip`);
  if (!res.ok) {
    throw new Error(`Failed to fetch nemlar.zip (${res.status})`);
  }
  const blob = await res.blob();
  const zip  = await JSZip.loadAsync(blob);
  const dict = {};

  await Promise.all(
    Object.values(zip.files)
      .filter(f => f.name.endsWith('.json'))
      .map(async f => {
        const content = await f.async('string');
        const { word, analyses } = JSON.parse(content);
        dict[word] = analyses;
      })
  );
  return dict;
}

// 3) Master loader
export async function loadCorpora() {
  const [qac, nemlar] = await Promise.all([
    loadQAC(),
    loadNemlar()
  ]);
  return { qac, nemlar };
}
