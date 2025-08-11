let surfaceKey = null; // will store the field name or index

export async function loadQACData() {
  console.log("main.jsx starting...");
  try {
    const res = await fetch("/qac.json");
    console.log(`Fetched qac.json, status: ${res.status}`);
    if (!res.ok) throw new Error(`Failed to load qac.json: ${res.statusText}`);

    const data = await res.json();
    console.log(`QAC data loaded, entries: ${data.length}`);

    if (data.length > 0) {
      const sample = data[0];
      if (typeof sample === "object" && !Array.isArray(sample)) {
        // object form — try to find the Arabic-looking key
        const possibleKeys = Object.keys(sample).filter(k =>
          /[\u0621-\u064A]/.test(sample[k])
        );
        surfaceKey = possibleKeys[0] || Object.keys(sample)[0];
      } else if (Array.isArray(sample)) {
        surfaceKey = 0; // assume first element is the surface form
      }
      console.log("Detected surfaceKey:", surfaceKey);
    }

    return data;
  } catch (err) {
    console.error("Error loading QAC data:", err);
    return [];
  }
}

export function getSurface(entry) {
  if (surfaceKey === null) return "";
  if (typeof entry === "object" && !Array.isArray(entry)) {
    return entry[surfaceKey] || "";
  } else if (Array.isArray(entry)) {
    return entry[surfaceKey] || "";
  }
  return "";
}

// Arabic normalization
export function normalizeArabic(text) {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "") // harakat
    .replace(/\u0640/g, "") // tatweel
    .replace(/[إأآ]/g, "ا") // alif
    .replace(/ى/g, "ي") // ya
    .trim();
}

export function stemArabic(text) {
  let t = normalizeArabic(text);
  t = t.replace(/^(ال|و|ف|ب|ك|ل|س)/, "");
  t = t.replace(/(ه|ها|هم|هن|كما|كم|نا|ي|ك)$/g, "");
  return t;
}
