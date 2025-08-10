/* QAC Analyzer — Context-locked, deterministic loader + tiered matcher
   - QAC-only: expects qac.json with entries having at least: form, stem, root
   - qac.txt used ONLY for line-count verification (no parsing)
   - Fallbacks: multiple path attempts for json/txt
*/

(() => {
  // ---------- DOM ----------
  const qs = (sel) => document.querySelector(sel);
  const el = {
    dataSource: qs('#data-source'),
    jsonCount: qs('#json-count'),
    txtCount: qs('#txt-count'),
    integrity: qs('#integrity'),
    loaderState: qs('#loader-state'),
    lastAction: qs('#last-action'),
    log: qs('#log'),
    input: qs('#word-input'),
    analyze: qs('#analyze-btn'),
    clear: qs('#clear-btn'),

    s1Summary: qs('#stage-1-summary'),
    s1List: qs('#stage-1-list'),
    s2Summary: qs('#stage-2-summary'),
    s2List: qs('#stage-2-list'),
    s3Summary: qs('#stage-3-summary'),
    s3List: qs('#stage-3-list'),
  };

  // ---------- Logging ----------
  const log = (...args) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    el.log.textContent += line;
    el.log.scrollTop = el.log.scrollHeight;
    el.lastAction.textContent = msg;
  };

  // ---------- Normalization ----------
  const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  const TATWEEL = /\u0640/g;

  const normalizeNFC = (s = '') => s.normalize('NFC');

  const stripDiacritics = (s = '') =>
    normalizeNFC(s).replace(TASHKEEL, '');

  const normalizeLetters = (s = '') =>
    normalizeNFC(s)
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/[ؤئ]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(TATWEEL, '');

  const letterNoDia = (s = '') => stripDiacritics(normalizeLetters(s));

  // ---------- Affix validation ----------
  const COMMON_PREFIXES = ['', 'و','ف','ب','ك','ل','س','ال','لل','بال','كال','فال','وال'];
  const COMMON_SUFFIXES = ['', 'ة','ه','ي','ك','هم','ها','نا','ان','ون','ين','ات','كما','كم','كن','هن'];

  function affixDecomposes(word, core) {
    for (const p of COMMON_PREFIXES) {
      if (!word.startsWith(p)) continue;
      const rest = word.slice(p.length);
      if (!rest.includes(core)) continue;
      if (rest === core) return true;
      const after = rest.slice(core.length);
      if (after.length >= 0 && COMMON_SUFFIXES.includes(after)) {
        return true;
      }
    }
    return false;
  }

  // ---------- Data state ----------
  const STATE = {
    entries: [],
    meta: {
      dataSource: '—',
      jsonCount: 0,
      txtCount: null,
      integrity: 'Pending',
    }
  };

  // ---------- Fetch helpers ----------
  const JSON_PATHS = ['./qac.json', './public/qac.json'];
  const TXT_PATHS  = ['./qac.txt', './public/qac.txt'];

  async function tryFetchJson(paths) {
    for (const url of paths) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('JSON root is not an array');
        log(`Loaded JSON from ${url} (${data.length} entries)`);
        return { url, data };
      } catch (e) {
        log(`JSON load failed at path: ${url} (${e.message})`);
      }
    }
    return null;
  }
     async function tryFetchTxt(paths) {
    for (const url of paths) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const lines = text.trim().split('\n');
        log(`Loaded TXT from ${url} (${lines.length} lines)`);
        return { url, lines };
      } catch (e) {
        log(`TXT load failed at path: ${url} (${e.message})`);
      }
    }
    return null;
  }

  // ---------- Loader ----------
  async function loadData() {
    el.loaderState.textContent = 'Loading...';
    const jsonResult = await tryFetchJson(JSON_PATHS);
    const txtResult = await tryFetchTxt(TXT_PATHS);

    if (jsonResult) {
      STATE.entries = jsonResult.data;
      STATE.meta.dataSource = jsonResult.url;
      STATE.meta.jsonCount = jsonResult.data.length;
    }

    if (txtResult) {
      STATE.meta.txtCount = txtResult.lines.length;
    }

    // Integrity check
    if (STATE.meta.jsonCount && STATE.meta.txtCount !== null) {
      STATE.meta.integrity = (STATE.meta.jsonCount === STATE.meta.txtCount)
        ? '✅ Match'
        : '⚠️ Mismatch';
    } else {
      STATE.meta.integrity = '❓ Unknown';
    }

    // Update UI
    el.dataSource.textContent = STATE.meta.dataSource;
    el.jsonCount.textContent = STATE.meta.jsonCount;
    el.txtCount.textContent = STATE.meta.txtCount ?? '—';
    el.integrity.textContent = STATE.meta.integrity;
    el.loaderState.textContent = 'Ready';
  }

  // ---------- Wire UI ----------
  function wireUI() {
    el.input.addEventListener('input', () => {
      const trimmed = el.input.value.trim();
      el.analyze.disabled = trimmed.length === 0;
    });

    el.clear.addEventListener('click', () => {
      el.input.value = '';
      el.analyze.disabled = true;
      clearResults();
    });

    el.analyze.addEventListener('click', () => {
      const raw = el.input.value.trim();
      if (!raw) return;
      const normalized = letterNoDia(raw);
      runAnalysis(normalized);
    });
  }

  // ---------- Clear ----------
  function clearResults() {
    el.s1Summary.textContent = '';
    el.s1List.innerHTML = '';
    el.s2Summary.textContent = '';
    el.s2List.innerHTML = '';
    el.s3Summary.textContent = '';
    el.s3List.innerHTML = '';
  }

  // ---------- Analysis ----------
  function runAnalysis(word) {
    clearResults();
    const matches = {
      exact: [],
      stem: [],
      root: [],
    };

    for (const entry of STATE.entries) {
      const normForm = letterNoDia(entry.form);
      const normStem = letterNoDia(entry.stem);
      const normRoot = letterNoDia(entry.root);

      if (word === normForm) {
        matches.exact.push(entry);
      } else if (word === normStem || affixDecomposes(word, normStem)) {
        matches.stem.push(entry);
      } else if (word === normRoot || affixDecomposes(word, normRoot)) {
        matches.root.push(entry);
      }
    }

    renderMatches(matches);
  }
     // ---------- Render ----------
  function renderMatches({ exact, stem, root }) {
    const total = exact.length + stem.length + root.length;
    log(`Found ${total} matches — Exact: ${exact.length}, Stem: ${stem.length}, Root: ${root.length}`);

    el.s1Summary.textContent = `Exact matches (${exact.length})`;
    el.s1List.innerHTML = exact.map(renderEntry).join('');

    el.s2Summary.textContent = `Stem matches (${stem.length})`;
    el.s2List.innerHTML = stem.map(renderEntry).join('');

    el.s3Summary.textContent = `Root matches (${root.length})`;
    el.s3List.innerHTML = root.map(renderEntry).join('');
  }

  function renderEntry(entry) {
    const safe = (s) => s ? s.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '—';
    return `<li><strong>${safe(entry.form)}</strong> | Stem: ${safe(entry.stem)} | Root: ${safe(entry.root)}</li>`;
  }

  // ---------- Init ----------
  window.addEventListener('DOMContentLoaded', async () => {
    log('Initializing QAC Analyzer...');
    wireUI();
    await loadData();
    el.analyze.disabled = true;
    log('Ready.');
  });
})();
/* End of QAC Analyzer
   - Context lock: QAC-only, no Nemlar
   - Assets: qac.json + qac.txt only
   - Integrity check: JSON count must match TXT line count
   - UI: Fully browser-based, no terminal required
   - Analysis: Tiered matcher (exact > stem > root), affix-aware
   - Accessibility: All results rendered in plain HTML
   - Reproducibility: Deterministic normalization, no hidden logic
   - Onboarding: No config, no build step, no dependencies
*/
