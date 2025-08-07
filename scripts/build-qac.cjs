// File: scripts/build-qac.cjs
'use strict';

const fs   = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

(async function build() {
  const inPath  = path.resolve(__dirname, '../public/qac.txt');
  const outPath = path.resolve(__dirname, '../public/qac.json');

  // 1. Read and drop blanks/comments
  if (!fs.existsSync(inPath)) {
    fail(`Input file not found: ${inPath}`);
  }
  const lines = fs.readFileSync(inPath, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.startsWith('#'));

  // 2. Locate header and compute column indexes
  const header = 'LOCATION\tFORM\tTAG\tFEATURES';
  const headerIndex = lines.indexOf(header);
  if (headerIndex < 0) {
    fail(`header "${header}" not found`);
  }
  const cols = header.split('\t');
  const idxLoc      = cols.indexOf('LOCATION');
  const idxForm     = cols.indexOf('FORM');
  const idxTag      = cols.indexOf('TAG');
  const idxFeatures = cols.indexOf('FEATURES');

  if ([idxLoc, idxForm, idxTag, idxFeatures].some(i => i < 0)) {
    fail('one of LOCATION, FORM, TAG or FEATURES is missing from header');
  }

  // 3. Take only data rows beginning with "("
  const dataRows = lines
    .slice(headerIndex + 1)
    .filter(line => line.charAt(0) === '(');

  // 4. Map to JSON objects
  const entries = dataRows.map(line => {
    const parts = line.split('\t');
    return {
      location: parts[idxLoc],
      form:     parts[idxForm],
      tag:      parts[idxTag],
      features: parts[idxFeatures]
    };
  });

  // 5. Write a pretty-printed JSON array
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`✔ Built qac.json with ${entries.length} entries`);

  // 6. Verify output file size (at least ~1 MB)
  const stats = fs.statSync(outPath);
  const minSize = 1e6; // 1 000 000 bytes
  if (stats.size < minSize) {
    fail(`qac.json too small (${stats.size} bytes < ${minSize})`);
  }
  console.log(`✔ Verified qac.json size: ${stats.size} bytes`);
  process.exit(0);

})().catch(err => {
  console.error(err);
  process.exit(1);
});