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
    // console.log(msg); // optional
  };

  // ---------- Normalization ----------
  const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g; // Arabic diacritics
  const TATWEEL = /\u0640/g; // ـ

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
    // Both inputs should already be letter-normalized and diacritics stripped
    for (const p of COMMON_PREFIXES) {
      if (!word.startsWith(p)) continue;
      const rest = word.slice(p.length);
      if (!rest.includes(core)) continue;
      if (rest === core) {
        // suffix empty
        return true;
      }
      // Require exact p + core + s equality
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

  // ---------- Fetch helpers with path fallbacks ----------
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

  async function tryFetchTxtLineCount(paths) {
    for (const url of paths) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        // Count non-empty lines
        const count = text.split(/\r?\n/).filter(line => line.trim().length > 0).length;
        log(`Counted ${count} non-empty lines in ${url}`);
        return { url, count };
      } catch (e) {
        log(`TXT count failed at path: ${url} (${e.message})`);
      }
    }
    return null;
  }

  // ---------- Precompute normalization ----------
  function shapeEntry(raw) {
    const form = (raw && raw.form) ? String(raw.form) : '';
    const stem = (raw && raw.stem) ? String(raw.stem) : '';
    const root = (raw && raw.root) ? String(raw.root) : '';

    const shaped = {
      form, stem, root,
      _n: {
        form_nfc: normalizeNFC(form),
        form_nodia: stripDiacritics(form),
        form_letters: normalizeLetters(form),
        form_letters_nodia: letterNoDia(form),

        stem_nfc: normalizeNFC(stem),
        stem_nodia: stripDiacritics(stem),
        stem_letters: normalizeLetters(stem),
        stem_letters_nodia: letterNoDia(stem),

        root_nfc: normalizeNFC(root),
        root_nodia: stripDiacritics(root),
        root_letters: normalizeLetters(root),
        root_letters_nodia: letterNoDia(root),
      }
    };
    return shaped;
  }

  // ---------- Loader ----------
  async function loadData() {
    el.loaderState.textContent = 'Loading qac.json…';
    const json = await tryFetchJson(JSON_PATHS);
    if (!json) {
      STATE.meta = { ...STATE.meta, integrity: 'ERROR', dataSource: 'Not found', jsonCount: 0 };
      renderMeta();
      el.loaderState.textContent = 'Failed: qac.json not found';
      el.integrity.classList.add('error');
      el.analyze.disabled = true;
      return;
    }

    const shaped = json.data.map(shapeEntry);
    STATE.entries = shaped;
    STATE.meta.dataSource = json.url;
    STATE.meta.jsonCount = shaped.length;
    el.loaderState.textContent = 'Loaded qac.json; validating with qac.txt…';

    const txt = await tryFetchTxtLineCount(TXT_PATHS);
    if (txt) {
      STATE.meta.txtCount = txt.count;
    } else {
      STATE.meta.txtCount = null; // not found is acceptable; we proceed
    }

    // Integrity policy:
    // - If txtCount exists and equals jsonCount => OK
    // - If txtCount exists and differs => WARN (still usable)
    // - If no txtCount => WARN (informational)
    if (STATE.meta.txtCount == null) {
      STATE.meta.integrity = 'WARN: qac.txt not found (skipped line-count validation)';
    } else if (STATE.meta.txtCount === STATE.meta.jsonCount) {
      STATE.meta.integrity = 'OK';
    } else {
      STATE.meta.integrity = `WARN: qac.json (${STATE.meta.jsonCount}) ≠ qac.txt rows (${STATE.meta.txtCount})`;
    }

    renderMeta();
    el.loaderState.textContent = 'Ready';
    el.analyze.disabled = false;
    log('Initialization complete');
  }

  function renderMeta() {
    el.dataSource.textContent = STATE.meta.dataSource;
    el.jsonCount.textContent = String(STATE.meta.jsonCount);
    el.txtCount.textContent = STATE.meta.txtCount == null ? '—' : String(STATE.meta.txtCount);
    el.integrity.textContent = STATE.meta.integrity;

    el.integrity.classList.remove('ok', 'warn', 'error');
    if (STATE.meta.integrity.startsWith('OK')) {
      el.integrity.classList.add('badge', 'ok');
    } else if (STATE.meta.integrity.startsWith('WARN')) {
      el.integrity.classList.add('badge', 'warn');
    } else if (STATE.meta.integrity.startsWith('ERROR')) {
      el.integrity.classList.add('badge', 'err');
    } else {
      // Pending
    }
  }

  // ---------- Matching ----------
  function matchQAC(inputWord, entries) {
    const in_nfc = normalizeNFC(inputWord.trim());
    const in_nodia = stripDiacritics(in_nfc);
    const in_letters = normalizeLetters(in_nfc);
    const in_letters_nodia = letterNoDia(in_nfc);

    const s1 = [];
    const s2 = [];
    const s3 = [];

    // Helpers to collect, with minimal duplication across stages
    const seen = new Set();
    const keyOf = (e) => `${e.form}␟${e.stem}␟${e.root}`;

    // Stage 1: surface form (descending strictness)
    for (const e of entries) {
      if (e._n.form_nfc === in_nfc ||
          e._n.form_nodia === in_nodia ||
          e._n.form_letters === in_letters ||
          e._n.form_letters_nodia === in_letters_nodia) {
        const k = keyOf(e);
        if (!seen.has(k)) {
          seen.add(k);
          s1.push(e);
        }
      }
    }

    // Stage 2: exact root/stem (same normalization levels)
    if (s1.length === 0) {
      for (const e of entries) {
        if (
          e._n.root_nfc === in_nfc || e._n.root_nodia === in_nodia ||
          e._n.root_letters === in_letters || e._n.root_letters_nodia === in_letters_nodia ||
          e._n.stem_nfc === in_nfc || e._n.stem_nodia === in_nodia ||
          e._n.stem_letters === in_letters || e._n.stem_letters_nodia === in_letters_nodia
        ) {
          const k = keyOf(e);
          if (!seen.has(k)) {
            seen.add(k);
            s2.push(e);
          }
        }
      }
    }

    // Stage 3: partial match + affix validation (operate on letters+no-diacritics)
    if (s1.length === 0 && s2.length === 0 && in_letters_nodia.length > 0) {
      for (const e of entries) {
        const cores = [
          e._n.root_letters_nodia,
          e._n.stem_letters_nodia
        ].filter(Boolean);

        for (const core of cores) {
          if (!core) continue;
          if (in_letters_nodia.includes(core) && affixDecomposes(in_letters_nodia, core)) {
            const k = keyOf(e);
            if (!seen.has(k)) {
              seen.add(k);
              s3.push(e);
            }
            break; // Entry accepted for Stage 3
          }
        }
      }
    }

    return { s1, s2, s3 };
  }

  // ---------- Rendering ----------
  function renderResults(groups) {
    const limit = 200; // safety cap for rendering

    const setSummary = (elSummary, arr, label) => {
      if (arr.length === 0) {
        elSummary.textContent = 'No matches.';
      } else {
        elSummary.textContent = `${arr.length} match${arr.length === 1 ? '' : 'es'} (${label})`;
      }
    };

    setSummary(el.s1Summary, groups.s1, 'surface form');
    setSummary(el.s2Summary, groups.s2, 'exact root/stem');
    setSummary(el.s3Summary, groups.s3, 'partial + affix-validated');

    const renderList = (listEl, arr) => {
      listEl.innerHTML = '';
      const toShow = arr.slice(0, limit);
      for (const e of toShow) {
        const li = document.createElement('li');
        li.className = 'match';
        li.innerHTML = `
          <div class="fields">
            <span class="kv"><span class="k">form:</span> <span class="v">${escapeHTML(e.form)}</span></span>
            <span class="kv"><span class="k">stem:</span> <span class="v">${escapeHTML(e.stem)}</span></span>
            <span class="kv"><span class="k">root:</span> <span class="v">${escapeHTML(e.root)}</span></span>
          </div>
          <div class="badges">
            <span class="badge">QAC</span>
          </div>
        `;
        listEl.appendChild(li);
      }
      if (arr.length > limit) {
        const more = document.createElement('div');
        more.className = 'summary';
        more.textContent = `…and ${arr.length - limit} more not shown`;
        listEl.appendChild(more);
      }
    };

    renderList(el.s1List, groups.s1);
    renderList(el.s2List, groups.s2);
    renderList(el.s3List, groups.s3);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  // ---------- Events ----------
  function wireUI() {
    el.analyze.addEventListener('click', onAnalyze);
    el.clear.addEventListener('click', onClear);
    el.input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        onAnalyze();
      }
    });
  }

  function onAnalyze() {
    const word = el.input.value || '';
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      renderResults({ s1: [], s2: [], s3: [] });
      log('Analyze: empty input');
      return;
    }
    const groups = matchQAC(trimmed, STATE.entries);
    renderResults(groups);
    log(`Analyze: "${trimmed}" => s1=${groups.s1.length}, s2=${groups.s2.length}, s3=${groups.s3.length}`);
  }

  function onClear() {
    el.input.value = '';
    renderResults({ s1: [], s2: [], s3: [] });
    el.input.focus();
    log('Cleared input and results');
  }

  // ---------- Boot ----------
  window.addEventListener('DOMContentLoaded', async () => {
    wireUI();
    await loadData();
  });
})();
