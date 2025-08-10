## Context Lock — QAC Loader + Matcher (v1.0)

- Data scope: QAC-only. The app MUST read from qac.json. No other corpora allowed.
- qac.txt: ONLY used to verify non-empty row count against qac.json length. No parsing, no implicit inference.
- Static paths (relative to site root): primary: ./public/qac.json; fallback: ./qac.json. Same for qac.txt.
- Failure policy:
  - If qac.json is missing/invalid: the app MUST disable Analyze and show error; no silent fallbacks.
  - If qac.txt is missing: proceed with WARN status.
  - If qac.txt count ≠ qac.json length: proceed with WARN status (no data mutation).
- Matching tiers (short):
  1) Surface form equality: exact NFC, no-diacritics, letter-normalized, letter-normalized+no-diacritics.
  2) Exact equality on root or stem with the same normalization levels.
  3) Substring match on root/stem (letter-normalized+no-diacritics) with prefix/suffix validation from fixed allowlists.
- Normalization:
  - Diacritics: remove Arabic marks [\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]
  - Letters: map {إأآا→ا, ى→ي, ؤ/ئ→ي, ة→ه} and remove tatweel (ـ)
- Affix allowlists (closed set; changes must be reviewed):
  - Prefixes: ['', و, ف, ب, ك, ل, س, ال, لل, بال, كال, فال, وال]
  - Suffixes: ['', ة, ه, ي, ك, هم, ها, نا, ان, ون, ين, ات, كما, كم, كن, هن]
- Rendering cap: show up to 200 matches per stage to keep UI responsive.
- No introduction of new datasets, build steps, or runtime dependencies without updating this section.
