// src/loader/qacJsonLoader.js

/**
 * Fetches and indexes your prebuilt public/qac.json.
 * Skips any entries whose `form` isn’t a string or contains “disclaimer”.
 */
export async function loadQacMap() {
  const resp = await fetch('/qac.json');
  if (!resp.ok) {
    throw new Error(`Failed to fetch /qac.json: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  const map = new Map();

  data.forEach(entry => {
    const { form, location } = entry || {};
    if (typeof form !== 'string') return;
    if (/disclaimer/i.test(form)) return;

    const info = { form, verseKey: location };
    if (!map.has(form)) map.set(form, []);
    map.get(form).push(info);
  });

  return map;
}