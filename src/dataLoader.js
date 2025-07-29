// src/dataLoader.js
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

// 1. Load QAC tokens from the text dump
export async function loadQAC() {
  const res = await fetch('/qac.txt');
  if (!res.ok) throw new Error('Failed to fetch qac.txt');
  const text = await res.text();
  
  // Each line is: word[TAB]analysis1|analysis2|…
  const lines = text.trim().split('\n');
  console.log('QAC lines fetched:', lines.length);

  const tokens = lines.map(line => {
    const [word, analyses] = line.split('\t');
    return {
      word,
      analyses: analyses ? analyses.split('|') : []
    };
  });

  console.log('Parsed QAC tokens:', tokens.length);
  return tokens;
}

// 2. Load & parse Nemlar XML files from the ZIP
export async function loadNemlar() {
  const res = await fetch('/nemlar.zip');
  if (!res.ok) throw new Error('Failed to fetch nemlar.zip');
  const buffer = await res.arrayBuffer();
  console.log('Nemlar ZIP size:', buffer.byteLength);

  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = Object.values(zip.files)
    .filter(f => f.name.toLowerCase().endsWith('.xml'));

  if (!xmlFiles.length) {
    throw new Error('No XML files found in Nemlar ZIP');
  }
  console.log('XML files found:', xmlFiles.map(f => f.name));

  const parser = new XMLParser({ ignoreAttributes: false });
  const docs = [];
  for (const file of xmlFiles) {
    const xmlText = await file.async('text');
    const jsonObj = parser.parse(xmlText);
    docs.push({ name: file.name, content: jsonObj });
  }

  console.log(`Parsed ${docs.length} Nemlar documents`);
  return docs;
}