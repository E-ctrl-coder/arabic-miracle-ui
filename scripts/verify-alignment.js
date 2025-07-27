// scripts/verify-alignment.cjs
import fs from "fs";
import path from "path";

const root = process.cwd();

// candidate locations
const quranCandidates = [
  path.join(root, "data", "quran.txt"),
  path.join(root, "public", "quran.txt"),
];
const qacCandidates = [
  path.join(root, "data", "quranic-corpus-morphology-0.4.txt"),
  path.join(root, "public", "quranic-corpus-morphology-0.4.txt"),
];

// pick the first one that exists
const quranPath = quranCandidates.find(fs.existsSync);
const qacPath = qacCandidates.find(fs.existsSync);

if (!quranPath) {
  throw new Error(
    `quran.txt not found in any of: ${quranCandidates.join(", ")}`
  );
}
if (!qacPath) {
  throw new Error(
    `quranic-corpus-morphology-0.4.txt not found in any of: ${qacCandidates.join(
      ", "
    )}`
  );
}

console.log("🔍 loading Quran text from:", quranPath);
console.log("🔍 loading morphology from:", qacPath);

// your existing read + alignment logic here, e.g.:
// const verses = fs.readFileSync(quranPath, "utf-8").split("\n");
// const morphLines = fs.readFileSync(qacPath, "utf-8").split("\n");
// …rest of verify‐alignment…
