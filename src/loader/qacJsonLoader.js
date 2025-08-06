// src/loader/qacJsonLoader.js

/**
 * Load the QAC map from /qac.json.
 * Each entry in your qac.json only has `form` and `location`.
 * We default any missing `root` or `pattern` to empty strings.
 */
export async function loadQacMap() {
  const resp = await fetch('/qac.json');
  if (!resp.ok) {
    throw new Error(`Failed to fetch /qac.json: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  const map = new Map();

  data.forEach(entry => {
    const { form, location, root = '', pattern = '' } = entry || {};

    if (typeof form !== 'string') return;
    if (/disclaimer/i.test(form)) return;

    const info = { form, verseKey: location, root, pattern };

    if (!map.has(form)) {
      map.set(form, []);
    }
    map.get(form).push(info);
  });

  return map;
}