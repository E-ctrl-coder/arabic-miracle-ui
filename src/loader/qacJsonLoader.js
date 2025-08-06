// src/loader/qacJsonLoader.js

export async function loadQacMap() {
  // Fetch the prebuilt QAC JSON (array of objects)
  const resp = await fetch('/qac.json');
  const data = await resp.json();
  // Map: formString → [ { root, pattern, verseKey, tokenIndex } ]
  const map = new Map();

  data.forEach(({ token, root, pattern, verseKey, tokenIndex }) => {
    const form = token;
    const info = { root, pattern, verseKey, tokenIndex, form };

    if (!map.has(form)) {
      map.set(form, []);
    }
    map.get(form).push(info);
  });

  return map;
}