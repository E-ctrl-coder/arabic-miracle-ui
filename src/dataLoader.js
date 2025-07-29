import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

// Load QAC tokens from qac.txt
export async function loadQAC() {
  const res = await fetch('/qac.txt');
  if (!res.ok) throw new Error('Failed to fetch qac.txt');
  const text = await res.text();
  const lines = text.trim().split('\n');
  console.log('QAC lines fetched:', lines.length);

  return lines.map(line => {
    const [word, analyses] = line.split('\t');
    return {
      word,
      analyses: analyses ? analyses.split('|') : []
    };
  });
}

// Load & parse Nemlar XML files from nemlar.zip
export async function loadNemlar() {
  const res = await fetch('/nemlar.zip');
  if (!res.ok) throw new Error('Failed to fetch nemlar.zip');
  const buffer = await res.arrayBuffer();
  console.log('Nemlar ZIP size:', buffer.byteLength);

  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = Object.values(zip.files)
    .filter(f => f.name.toLowerCase().endsWith('.xml'));

  if (!xmlFiles.length) {
    throw new Error('No XML files found in nemlar.zip');
  }
  console.log('XML files found:', xmlFiles.map(f => f.name));

  const parser = new XMLParser({ ignoreAttributes: false });
  const docs = [];
  for (const file of xmlFiles) {
    const xmlText = await file.async('text');
    docs.push({
      name: file.name,
      content: parser.parse(xmlText)
    });
  }

  console.log(`Parsed ${docs.length} Nemlar documents`);
  return docs;
}