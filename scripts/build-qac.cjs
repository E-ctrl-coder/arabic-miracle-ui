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
  const lines = fs.readFileSync(inPath, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.startsWith('#'));

  // 2. Locate header and compute column indexes
  const header = lines.find(line => line === 'LOCATION\tFORM\tTAG\tFEATURES');
  if (!header) fail('header "LOCATION<TAB>FORM<TAB>TAG<TAB>FEATURES" not found');
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
    .slice(lines.indexOf(header) + 1)
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
})().catch(err => {
  console.error(err);
  process.exit(1);
});