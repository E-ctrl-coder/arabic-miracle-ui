// Loader for QAC JSON and Quran text
export async function loadQacData() {
  const res = await fetch("/qac.json");
  if (!res.ok) throw new Error("Failed to load qac.json");
  return await res.json();
}

export async function loadQuranText() {
  const res = await fetch("/quraan.txt");
  if (!res.ok) throw new Error("Failed to load quraan.txt");
  const text = await res.text();

  // Convert into dictionary: { "sura:ayah": "verse text" }
  const verseMap = {};
  text.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(\d+):(\d+)\s+(.*)$/);
    if (match) {
      const key = `${match[1]}:${match[2]}`;
      verseMap[key] = match[3];
    }
  });
  return verseMap;
}
