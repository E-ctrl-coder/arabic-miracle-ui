// src/loader/qacJsonLoader.js
// Loads public/qac.json and builds a Map<form, Array<enrichedEntry>> suitable for the UI.

export async function loadQacMap() {
  // Use a relative path so it works in static hosting and Codespaces previews.
  // If your host maps /public to the root, you can switch this to '/qac.json'.
  const resp = await fetch('/qac.json');
  if (!resp.ok) {
    throw new Error(`Failed to fetch public/qac.json: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error('qac.json is not an array');
  }

  const map = new Map();

  for (const entry of data) {
    if (!entry || typeof entry.form !== 'string' || !entry.form.trim()) continue;

    const form = entry.form; // Arabic surface form (e.g., "بِسْمِ")
    const verseKey = entry.location || entry.verseKey || null;

    // Segments may be present as { prefixes:[], stem:'', suffixes:[] }
    const seg = entry.segments || {};
    const prefix = Array.isArray(seg.prefixes) ? seg.prefixes.join('') : '';
    const stem   = typeof seg.stem === 'string' ? seg.stem : '';
    const suffix = Array.isArray(seg.suffixes) ? seg.suffixes.join('') : '';

    // Enrich to match what renderResults() expects
    const enriched = {
      verseKey,
      surface: form,
      root: entry.root ?? null,
      stem,
      prefix,
      suffix,
      tag: entry.tag ?? null,
      features: Array.isArray(entry.features) ? entry.features : [],
      lemma: entry.lemma ?? null
    };

    if (!map.has(form)) map.set(form, []);
    map.get(form).push(enriched);
  }

  return map;
}
