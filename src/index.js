// src/index.js

import { loadQacMap } from './loader/qacJsonLoader.js';

// 1. Safely strip Arabic diacritics (tashkīl)
function stripDiacritics(s) {
  return (s || '').replace(/[\u064B-\u0652\u0670]/g, '');
}

// 2. Normalize common letter variants (keep tashkīl)
function normalizeLetters(s) {
  return (s || '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '');
}

// 3. Generate stems by stripping prefixes/suffixes
function stripAffixes(s) {
  const prefixes = ['وال','فال','بال','كال','لل','ال','و','ف','ب','ك','ل','س'];
  const suffixes = ['ات','ان','ين','ون','ة','ه','ها','هم','نا','ي'];
  const stems = new Set([s]);

  prefixes.forEach(pref => {
    if (s.startsWith(pref)) stems.add(s.slice(pref.length));
  });
  suffixes.forEach(suf => {
    if (s.endsWith(suf)) stems.add(s.slice(0, -suf.length));
  });
  prefixes.forEach(pref => {
    if (s.startsWith(pref)) {
      const mid = s.slice(pref.length);
      suffixes.forEach(suf => {
        if (mid.endsWith(suf)) stems.add(mid.slice(0, -suf.length));
      });
    }
  });

  return [...stems].filter(x => x);
}

// 4. Helper: scan qacMap for forms matching the predicate
function findMatches(predicate) {
  const out = [];
  for (const [form, infos] of qacMap) {
    if (predicate(form)) out.push(...infos);
  }
  return out;
}

// 5. Highlight root letters only if pattern exists
function highlightRootLetters(form, pattern) {
  if (!pattern) return form;

  const positions = [];
  for (let i = 0; i < pattern.length; i++) {
    if (['f','3','l'].includes(pattern[i])) positions.push(i);
  }

  return [...form]
    .map((ch, idx) =>
      positions.includes(idx)
        ? `<span class="root-letter">${ch}</span>`
        : ch
    )
    .join('');
}

let qacMap = new Map();

async function main() {
  try {
    qacMap = await loadQacMap();
  } catch (err) {
    console.error('خطأ في تحميل بيانات QAC:', err);
    document.getElementById('step-info').textContent = 'خطأ في التحميل.';
    return;
  }
  document.getElementById('go').addEventListener('click', handleAnalyze);
}

function handleAnalyze() {
  const raw = document.getElementById('lookup').value.trim();
  if (!raw) return;

  document.getElementById('step-info').textContent = '';
  document.getElementById('qac-panel').innerHTML = '';

  let results = [];
  let stepDesc = '';

  // Stage 1: exact match (with tashkīl)
  results = qacMap.get(raw) || [];
  if (results.length) {
    stepDesc = 'مطابقة دقيقة (مع تشكيل)';
  }

  // Stage 2: exact match without tashkīl
  if (!results.length) {
    const key = stripDiacritics(raw);
    results = findMatches(frm => stripDiacritics(frm) === key);
    if (results.length) {
      stepDesc = 'مطابقة بدون تشكيل';
    }
  }

  // Stage 3: normalize letters (keep tashكīl)
  if (!results.length) {
    const norm = normalizeLetters(raw);
    results = findMatches(frm => normalizeLetters(frm) === norm);
    if (results.length) {
      stepDesc = 'مطابقة بعد التطبيع (مع تشكيل)';
    }
  }

  // Stage 4: normalize + strip tashكīl
  if (!results.length) {
    const normStrip = stripDiacritics(normalizeLetters(raw));
    results = findMatches(
      frm => stripDiacritics(normalizeLetters(frm)) === normStrip
    );
    if (results.length) {
      stepDesc = 'مطابقة بعد التطبيع وبدون تشكيل';
    }
  }

  // Stage 5: strip prefixes/suffixes + normalize+strip tashكīl
  if (!results.length) {
    const base = stripDiacritics(normalizeLetters(raw));
    const stems = stripAffixes(base);
    for (const stem of stems) {
      results = findMatches(
        frm => stripDiacritics(normalizeLetters(frm)) === stem
      );
      if (results.length) {
        stepDesc = 'مطابقة بعد إزالة السوابق واللواحق';
        break;
      }
    }
  }

  renderResults(results);
  document.getElementById('step-info').textContent = stepDesc || 'لا نتائج.';
}

function renderResults(entries) {
  const panel = document.getElementById('qac-panel');
  if (!entries.length) {
    panel.textContent = 'لا توجد نتائج.';
    return;
  }

  const ul = document.createElement('ul');
  entries.forEach(({ form, pattern, root, verseKey }) => {
    const li = document.createElement('li');
    const display = pattern
      ? highlightRootLetters(form, pattern)
      : form;

    li.innerHTML = [
      `الآية ${verseKey}:`,
      `<strong>${display}</strong>`,
      `(الصيغة: ${form})`,
      root ? `الجذر: ${root}` : '',
      pattern ? `البنية: ${pattern}` : ''
    ].filter(Boolean).join(' ');
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

main().catch(err => {
  console.error('خطأ في التهيئة:', err);
  document.getElementById('step-info').textContent = `خطأ: ${err.message}`;
});