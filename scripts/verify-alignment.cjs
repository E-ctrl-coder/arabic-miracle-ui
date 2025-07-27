cat > scripts/verify-alignment.cjs << 'EOF'
#!/usr/bin/env node

const fs   = require("fs");
const path = require("path");

// 1. Show where we’re running from
console.log("🔄 process.cwd() =", process.cwd());

// 2. Candidate paths under data/ or public/
const root = process.cwd();
const quranCandidates = [
  path.join(root, "data", "quran.txt"),
  path.join(root, "public", "quran.txt"),
];
const qacCandidates = [
  path.join(root, "data", "quranic-corpus-morphology-0.4.txt"),
  path.join(root, "public", "quranic-corpus-morphology-0.4.txt"),
];

// 3. Pick the first existing file
const quranPath = quranCandidates.find(fs.existsSync);
const qacPath   = qacCandidates.find(fs.existsSync);

if (!quranPath) {
  console.error("❌ Quran file not found. Tried:\n", quranCandidates.join("\n"));
  process.exit(1);
}
if (!qacPath) {
  console.error("❌ Morphology file not found. Tried:\n", qacCandidates.join("\n"));
  process.exit(1);
}

console.log("✅ loading Quran from    :", quranPath);
console.log("✅ loading morphology from:", qacPath);

// 4. Read & split
const quranText  = fs.readFileSync(quranPath, "utf-8");
const morphLines = fs.readFileSync(qacPath,   "utf-8").split(/\r?\n/);

// 5. Quick verse‐count check
const verses = quranText.trim().split(/\r?\n/).filter(Boolean);
if (verses.length !== morphLines.length) {
  console.error(
    `❌ Verse count mismatch: Quran has ${verses.length}, morphology has ${morphLines.length}`
  );
  process.exit(1);
}

console.log("🎉 Verse counts match. Proceed with token-level alignment…");
// ← your token‐alignment logic continues here…
EOF

chmod +x scripts/verify-alignment.cjs
