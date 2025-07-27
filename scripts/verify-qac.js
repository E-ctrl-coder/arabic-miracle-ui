#!/usr/bin/env node
// scripts/verify-qac.js (ESM)

import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

// —— Helpers ——

// Exit with message if file doesn’t exist
function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: file not found → ${filePath}`);
    console.error('Contents of project root:', fs.readdirSync(projectRoot));
    process.exit(1);
  }
}

// —— Paths ——

// point at public/quran-qac.json and data/quran-corpus-morphology-0.4.txt
const jsonPath = path.join(projectRoot, 'public', 'quran-qac.json');
const txtPath  = path.join(projectRoot, 'data',   'quran-corpus-morphology-0.4.txt');

ensureFile(jsonPath);
ensureFile(txtPath);

// —— Load & parse JSON —— 

let rawJson;
try {
  rawJson = fs.readFileSync(jsonPath, 'utf8');
} catch (err) {
  console.error(`Failed to read JSON file: ${err.message}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(rawJson);
} catch (err) {
  console.error(`Invalid JSON at ${jsonPath}: ${err.message}`);
  process.exit(1);
}

// support either top-level array or { segments: [...] }
const segments = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed.segments)
    ? parsed.segments
    : null;

if (!segments) {
  console.error(
    `Unexpected JSON structure. ` +
    `Expected an array or { segments: Array }, got:\n`,
    parsed
  );
  process.exit(1);
}

console.log(`Loaded ${segments.length} segments from ${jsonPath}`);

// —— Load & filter TXT —— 

const txtLines = fs
  .readFileSync(txtPath, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.startsWith('#'));

console.log(`Original QAC lines (ignoring comments): ${txtLines.length}`);

// —— Compare counts —— 

if (segments.length !== txtLines.length) {
  console.error(
    `✘ Count mismatch:\n` +
    `  JSON segments: ${segments.length}\n` +
    `  TXT lines:     ${txtLines.length}`
  );
  process.exit(1);
}

console.log('✔ verify-qac: counts match, build can proceed.');
