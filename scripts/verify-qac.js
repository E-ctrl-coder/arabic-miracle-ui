// scripts/verify-qac.js (ESM)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.resolve(__dirname, '../public/quran-qac.json');
const txtPath  = path.resolve(__dirname, '../data/quran-corpus-morphology-0.4.txt');

const segments = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Loaded ${segments.length} segments from ${jsonPath}`);

const txtLines = fs
  .readFileSync(txtPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.startsWith('#'));
console.log(`Original QAC lines (ignoring #comments): ${txtLines.length}`);

if (segments.length !== txtLines.length) {
  console.error(
    `✘ Mismatch: JSON has ${segments.length}, TXT has ${txtLines.length}`
  );
  process.exit(1);
}

console.log('✔ verify-qac: counts match, build can proceed.');
