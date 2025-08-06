// src/index.js

import { loadQacMap } from './loader/qacJsonLoader.js';

// Utility: remove Arabic diacritics
function stripDiacritics(str) {
  return str.replace(/[\u064B-\u0652\u0670]/g, '');
}

// Utility: wrap root letters (pattern f 3 l) in a span for highlighting
function highlightRootLetters(form, pattern) {
  const rootPositions = [...pattern].reduce((pos, ch, idx) => {
    if (ch === 'f' || ch === '3' || ch === 'l') {
      pos.push(idx);
    }
    return pos;
  }, []);

  return [...form]
    .map((ch, idx) =>
      rootPositions.includes(idx)
        ? `<span class="root-letter">${ch}</span>`
        : ch
    )
    .join('');
}

let qacMap = new Map();
const dictionary = new Map();

/**
 * Entry point: load QAC data and wire up UI handlers
 */
async function main() {
  console.log('⏳ Loading QAC JSON…');
  qacMap = await loadQacMap();
  console.log('✅ QAC entries loaded:', qacMap.size);

  document.getElementById('go').addEventListener('click', handleAnalyze);
  document.getElementById('dict-toggle').addEventListener('click', toggleDictionary);
}

/**
 * Called when user clicks "Analyze"
 */
function handleAnalyze() {
  const input = document.getElementById('lookup').value.trim();
  if (!input) return;

  // Clear previous results and dictionary state
  document.getElementById('step-info').textContent = '';
  document.getElementById('qac-panel').innerHTML = '';
  dictionary.clear();

  // 1. Exact form match
  let results = qacMap.get(input) || [];
  let stepDesc = 'Exact form match';

  // 2. Fallback: stripped-diacritics match
  if (!results.length) {
    const stripped = stripDiacritics(input);
    for (const [form, entries] of qacMap) {
      if (stripDiacritics(form) === stripped) {
        results = results.concat(entries);
      }
    }
    stepDesc = 'Fallback match (diacritics stripped)';
  }

  renderQacResults(results);
  buildDictionary(results);
  document.getElementById('step-info').textContent = `QAC: ${stepDesc}`;
}

/**
 * Render a list of verse occurrences with root-letter highlighting
 */
function renderQacResults(entries) {
  const panel = document.getElementById('qac-panel');
  if (!entries.length) {
    panel.textContent = 'No QAC entries found.';
    return;
  }

  const ul = document.createElement('ul');
  entries.forEach(({ form, root, pattern, verseKey }) => {
    const li = document.createElement('li');
    li.innerHTML = [
      `Verse ${verseKey}:`,
      `<strong>${highlightRootLetters(form, pattern)}</strong>`,
      `(form: ${form})`,
      `Pattern: ${pattern}`,
      `Root: ${root}`
    ].join(' ');
    ul.appendChild(li);
  });

  panel.appendChild(ul);
}

/**
 * Build the mini-dictionary (root → patterns) from results
 */
function buildDictionary(entries) {
  entries.forEach(({ root, pattern }) => {
    if (!dictionary.has(root)) {
      dictionary.set(root, new Set());
    }
    dictionary.get(root).add(pattern);
  });
  renderDictionaryView();
}

/**
 * Display the mini-dictionary view
 */
function renderDictionaryView() {
  const panel = document.getElementById('dictionary-panel');
  panel.innerHTML = '';

  dictionary.forEach((patterns, root) => {
    const div = document.createElement('div');
    div.innerHTML = [
      `<h3>Root: ${root}</h3>`,
      `<ul>${[...patterns].map(p => `<li>${p}</li>`).join('')}</ul>`
    ].join('');
    panel.appendChild(div);
  });
}

/**
 * Toggle the mini-dictionary panel visibility
 */
function toggleDictionary() {
  const panel = document.getElementById('dictionary-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

main().catch(err => {
  console.error('Initialization error:', err);
  document.getElementById('step-info').textContent = `Error: ${err.message}`;
});