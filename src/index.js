import { loadQacMap } from './loader/qacJsonLoader.js';

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

function normalizeArabic(s = '') {
  return s.normalize('NFC');
}

function stripDiacritics(s) {
  return normalizeArabic(s).replace(TASHKEEL, '');
}

function normalizeLetters(s) {
  return normalizeArabic(s)
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '');
}

function stripAffixes(s) {
  const prefixes = ['وال','فال','بال','كال','لل','ال','و','ف','ب','ك','ل','س'];
  
  const suffixes =['ة','وا','ي','ك','ه','ها','نا','كم','تم','تن','م','ن','كن','هم','هن','كما','ان','ون','ين','ات'];
  const stems = new Set([s]);

  prefixes.forEach(p => s.startsWith(p) && stems.add(s.slice(p.length)));
  suffixes.forEach(x => s.endsWith(x) && stems.add(s.slice(0, -x.length)));
  prefixes.forEach(p => {
    if (!s.startsWith(p)) return;
    const mid = s.slice(p.length);
    suffixes.forEach(x => mid.endsWith(x) && stems.add(mid.slice(0, -x.length)));
  });

  stems.delete('');
  return [...stems];
}

let qacMap = new Map();

async function main() {
  qacMap = await loadQacMap();
  document.getElementById('go').addEventListener('click', handleAnalyze);
}

function findMatches(fn) {
  const out = [];
  for (const [surface, entries] of qacMap) {
    if (fn(surface)) out.push(...entries);
  }
  return out;
}

function dedupe(entries) {
  const seen = new Set();
  return entries.filter(e => {
    const key = `${e.verseKey}|${e.surface}`;
    return seen.has(key) ? false : seen.add(key);
  });
}

function handleAnalyze() {
  const input = document.getElementById('lookup').value.trim();
  const panel = document.getElementById('qac-panel');
  const info  = document.getElementById('step-info');
  const debug = document.getElementById('debug-panel');
  panel.innerHTML = '';
  info.textContent  = '';
  debug.innerHTML = '';

  if (!input) return;

  const raw        = normalizeArabic(input);
  let results      = [];
  let stageMessage = '';

  // Stage 1: exact (with tashkīl)
  results = findMatches(s => normalizeArabic(s) === raw);
  if (results.length) stageMessage = 'مرحلة 1: مطابقة دقيقة (مع تشكيل)';

  // Stage 2: without tashkīل
  if (!results.length) {
    const bare = stripDiacritics(raw);
    results = findMatches(s => stripDiacritics(s) === bare);
    if (results.length) stageMessage = 'مرحلة 2: بدون تشكيل';
  }

  // Stage 3: normalize letters (with tashkīل)
  if (!results.length) {
    const norm = normalizeLetters(raw);
    results = findMatches(s => normalizeLetters(s) === norm);
    if (results.length) stageMessage = 'مرحلة 3: تطبيع (مع تشكيل)';
  }

  // Stage 4: normalize + strip tashkīل
  if (!results.length) {
    const normBare = stripDiacritics(normalizeLetters(raw));
    results = findMatches(s => stripDiacritics(normalizeLetters(s)) === normBare);
    if (results.length) stageMessage = 'مرحلة 4: تطبيع + بدون تشكيل';
  }

  // Stage 5: affix-stripping
  if (!results.length) {
    const base  = stripDiacritics(normalizeLetters(raw));
    const stems = stripAffixes(base);
    for (const st of stems) {
      results = findMatches(s => stripDiacritics(normalizeLetters(s)) === st);
      if (results.length) {
        stageMessage = 'مرحلة 5: إزالة السوابق واللواحق';
        break;
      }
    }
  }

  results = dedupe(results);
  info.textContent = stageMessage || 'لا توجد نتائج.';
  renderResults(results);

  // DEBUG OUTPUT
  debug.innerHTML = `
    <div style="font-family: sans-serif; background: #f0f0f0; border: 1px dashed #999; padding: 1em; margin-top: 1em;">
      <div>🔤 الإدخال الخام: <code>${input}</code></div>
      <div>🧼 بعد التطبيع: <code>${raw}</code></div>
      <div>🔍 عدد النتائج المحتملة: ${results.length}</div>
      <div>📋 المرحلة المختارة: ${stageMessage || '—'}</div>
    </div>
  `;
}

function renderResults(entries) {
  const panel = document.getElementById('qac-panel');
  if (!entries.length) {
    panel.textContent = 'لا توجد نتائج.';
    return;
  }
  const ul = document.createElement('ul');
  entries.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>الآية: ${e.verseKey}</div>
      <div>الكلمة: ${e.surface}</div>
      <div>البادئة: ${e.prefix}</div>
      <div>الجذر: ${e.root}</div>
      <div>الجذع: ${e.stem}</div>
      <div>اللاحقة: ${e.suffix}</div>
    `;
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

async function inspectQacSurfaces() {
  const map = await loadQacMap();
  const surfaces = [...map.keys()];
  console.log('🔍 Sample surfaces:', surfaces.slice(0, 20));
}

inspectQacSurfaces();
main().catch(err => {
  console.error('Initialization error:', err);
  document.getElementById('step-info').textContent = `خطأ: ${err.message}`;
});
