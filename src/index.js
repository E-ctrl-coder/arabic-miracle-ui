// src/index.js
(() => {
  "use strict";

  // ---- Minimal styles (injected) ----
  const css = `
  :root {
    --bg: #0b0d0f;
    --panel: #13181c;
    --panel-2: #0f1418;
    --text: #e6edf3;
    --muted: #9aa4ad;
    --accent: #3ea6ff;
    --accent-2: #00c2ff;
    --ok: #30d158;
    --warn: #ffd60a;
    --err: #ff453a;
    --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    --round: 10px;
  }
  html, body {
    margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Helvetica Neue", sans-serif;
  }
  #app {
    max-width: 1100px; margin: 24px auto; padding: 0 16px 32px;
  }
  .header {
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px;
  }
  .title {
    font-weight: 700; font-size: 18px; letter-spacing: 0.2px;
  }
  .summary {
    color: var(--muted); font-size: 13px;
  }
  .controls {
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: var(--panel);
    border: 1px solid #1f2a33; border-radius: var(--round); padding: 12px; margin: 12px 0 16px;
  }
  .controls label { font-size: 13px; color: var(--muted); margin-right: 6px; }
  .controls select, .controls input[type="text"] {
    background: var(--panel-2); color: var(--text); border: 1px solid #23303b; border-radius: 8px;
    padding: 8px 10px; font-size: 14px; outline: none;
  }
  .controls input[type="text"]::placeholder { color: #72808c; }
  .note { font-size: 12px; color: var(--muted); }
  .groups {
    display: grid; grid-template-columns: 1fr; gap: 10px;
  }
  .group {
    background: var(--panel); border: 1px solid #1f2a33; border-radius: var(--round); overflow: hidden;
  }
  .group-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 12px; cursor: pointer; user-select: none;
    border-bottom: 1px solid #1b232b;
  }
  .gkey {
    font-family: var(--mono); font-size: 13px; color: var(--accent);
    word-break: break-word;
  }
  .gcounts { font-size: 12px; color: var(--muted); }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; background: #15202b; border: 1px solid #24313b; margin-left: 6px; color: #cfe7ff; }
  .group-body { display: none; padding: 8px 10px; }
  .occ {
    border: 1px solid #1d2831; border-radius: 8px; padding: 8px; margin: 8px 0; background: #10161b;
  }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
  .tag {
    font-family: var(--mono); font-size: 12px; color: #cbd6df; background: #0e1419; border: 1px solid #1c2630; border-radius: 6px; padding: 2px 6px;
  }
  .field-label { font-size: 12px; color: var(--muted); margin-right: 6px; }
  .arabic { direction: rtl; unicode-bidi: isolate; font-size: 18px; }
  .verse {
    direction: rtl; unicode-bidi: isolate; background: #0f151a; border: 1px dashed #21303b; color: #f8fafc;
    padding: 10px; border-radius: 8px; margin-top: 8px;
  }
  .btn {
    background: #0e151b; color: var(--text); border: 1px solid #20303a;
    border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 13px;
  }
  .btn:hover { border-color: #2a3a46; }
  .ref { color: var(--accent-2); text-decoration: none; }
  .warn { color: var(--warn); }
  .err { color: var(--err); }
  .hr { height: 1px; background: #1d2831; margin: 10px 0; }
  .muted { color: var(--muted); }
  .stack { display: grid; gap: 4px; }
  .spacer { flex: 1; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- Root container ----
  const app = document.createElement("div");
  app.id = "app";
  document.body.appendChild(app);

  // ---- Utilities ----
  const byNum = (a, b) => a - b;
  const safeJoin = (arr, sep = " + ") => (Array.isArray(arr) && arr.length ? arr.join(sep) : "");
  const parseLocation = (loc) => {
    // "s:v:w" (1-based)
    const [s, v, w] = String(loc).split(":").map((x) => Number(x));
    return { s, v, w, key: `${s}:${v}`, triple: `${s}:${v}:${w}` };
  };
  const parseQuraanTxt = (txt) => {
    // Each line: s|v|text
    const map = new Map();
    const issues = [];
    let lines = txt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const parts = raw.split("|");
      if (parts.length < 3) {
        issues.push({ line: i + 1, raw, reason: "Expected s|v|text" });
        continue;
      }
      const s = Number(parts[0]);
      const v = Number(parts[1]);
      const verseText = parts.slice(2).join("|").trim();
      if (!Number.isFinite(s) || !Number.isFinite(v) || !verseText) {
        issues.push({ line: i + 1, raw, reason: "Non-numeric s/v or empty text" });
        continue;
      }
      map.set(`${s}:${v}`, verseText);
    }
    return { map, issues, lineCount: lines.length, verseCount: map.size };
  };

  const el = (tag, opts = {}, ...children) => {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.html != null) node.innerHTML = opts.html;
    if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
    children.flat().forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  const fetchJSON = async (path) => {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  };
  const fetchText = async (path) => {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
  };

  // ---- App state ----
  const state = {
    entries: [],        // normalized QAC entries
    verseMap: new Map(),// "s:v" -> verse text
    issues: [],         // parsing issues (quraan.txt)
    groupsCache: new Map(), // dim -> Map(key -> array of entries)
    dims: [
      { id: "root", label: "Root (Buckwalter)" },
      { id: "lemma", label: "Lemma (Buckwalter)" },
      { id: "stem", label: "Stem (Arabic)" },
      { id: "form", label: "Form (Arabic token)" },
      { id: "tag", label: "POS Tag" },
    ],
    currentDim: "root",
    filter: "",
  };

  // ---- Render scaffold ----
  const header = el("div", { class: "header" },
    el("div", { class: "title" }, "QAC explorer (root → occurrences → inline verse)"),
    el("div", { class: "spacer" }),
    el("div", { class: "summary", attrs: { id: "summary" } }, "Loading…")
  );

  const controls = el("div", { class: "controls" },
    el("div", {},
      el("label", {}, "Group by"),
      (() => {
        const sel = el("select", { attrs: { id: "dim" } });
        state.dims.forEach(d => {
          const o = el("option", { text: d.label, attrs: { value: d.id } });
          if (d.id === state.currentDim) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", () => {
          state.currentDim = sel.value;
          renderGroups();
        });
        return sel;
      })()
    ),
    el("div", {},
      el("label", {}, "Filter groups"),
      (() => {
        const inp = el("input", { attrs: { id: "filter", type: "text", placeholder: "Type to filter (case-sensitive)" } });
        inp.addEventListener("input", () => {
          state.filter = inp.value;
          renderGroups();
        });
        return inp;
      })()
    ),
    el("div", { class: "note" }, "Tip: click a group to expand; click a “s:v” to reveal the verse inline.")
  );

  const groupsBox = el("div", { class: "groups", attrs: { id: "groups" } });

  app.appendChild(header);
  app.appendChild(controls);
  app.appendChild(groupsBox);

  // ---- Data loading ----
  (async function init() {
    try {
      const [qac, qtxt] = await Promise.all([
        fetchJSON("/qac.json"),
        fetchText("/quraan.txt"),
      ]);

      // Normalize QAC entries
      state.entries = qac.map((e, idx) => {
        const loc = parseLocation(e.location);
        return {
          i: idx, // original index
          s: loc.s, v: loc.v, w: loc.w, key: loc.key, triple: loc.triple,
          form: e.form,                 // Arabic token
          lemma: e.lemma,               // Buckwalter
          root: e.root,                 // Buckwalter
          tag: e.tag,                   // POS
          features: Array.isArray(e.features) ? [...e.features] : [],
          segments: {
            prefixes: (e.segments && Array.isArray(e.segments.prefixes)) ? [...e.segments.prefixes] : [],
            stem: (e.segments && e.segments.stem) ? e.segments.stem : "",
            suffixes: (e.segments && Array.isArray(e.segments.suffixes)) ? [...e.segments.suffixes] : []
          }
        };
      });

      // Parse Qur’ān text
      const { map, issues, verseCount } = parseQuraanTxt(qtxt);
      state.verseMap = map;
      state.issues = issues;

      // Update summary
      const uniqVersesFromQAC = new Set(state.entries.map(e => e.key)).size;
      const uniqRoots = new Set(state.entries.map(e => e.root)).size;
      document.getElementById("summary").textContent =
        `Tokens: ${state.entries.length.toLocaleString()} • QAC verses: ${uniqVersesFromQAC.toLocaleString()} • Text verses: ${verseCount.toLocaleString()} • Unique roots: ${uniqRoots.toLocaleString()}`;

      // Initial render
      renderGroups();

      // If any issues parsing quraan.txt, show a small warning panel
      if (state.issues.length) {
        app.insertBefore(
          el("div", { class: "controls" },
            el("div", { class: "warn" }, `Note: ${state.issues.length} line(s) in quraan.txt were skipped due to format issues (expected "s|v|text").`),
            el("div", { class: "muted" }, "Open the developer console to inspect details if needed.")
          ),
          groupsBox
        );
        // eslint-disable-next-line no-console
        console.warn("quraan.txt parse issues:", state.issues);
      }
    } catch (err) {
      app.innerHTML = "";
      app.appendChild(
        el("div", { class: "controls" },
          el("div", { class: "err" }, "Failed to load data."),
          el("div", {}, String(err && err.message ? err.message : err))
        )
      );
    }
  })();

  // ---- Grouping + rendering ----
  function groupByDim(dim) {
    if (state.groupsCache.has(dim)) return state.groupsCache.get(dim);

    const map = new Map();
    for (const e of state.entries) {
      let key;
      switch (dim) {
        case "root": key = e.root || ""; break;
        case "lemma": key = e.lemma || ""; break;
        case "stem": key = e.segments.stem || ""; break;
        case "form": key = e.form || ""; break;
        case "tag": key = e.tag || ""; break;
        default: key = ""; break;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    // Cache
    state.groupsCache.set(dim, map);
    return map;
  }

  function renderGroups() {
    const groupsEl = document.getElementById("groups");
    groupsEl.innerHTML = "";

    const groups = groupByDim(state.currentDim);
    const keys = Array.from(groups.keys());
    keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const filteredKeys = state.filter ? keys.filter(k => k.includes(state.filter)) : keys;

    if (!filteredKeys.length) {
      groupsEl.appendChild(el("div", { class: "muted" }, "No groups match your filter."));
      return;
    }

    const frag = document.createDocumentFragment();

    for (const gkey of filteredKeys) {
      const items = groups.get(gkey) || [];
      // Sort items by s, v, w
      items.sort((a, b) => a.s - b.s || a.v - b.v || a.w - b.w);

      // Unique verse count per group
      const verseSet = new Set(items.map(e => e.key));

      const group = el("div", { class: "group" });
      const head = el("div", { class: "group-head", attrs: { role: "button", tabindex: "0", "aria-expanded": "false" } },
        el("div", {},
          el("div", { class: "gkey" }, gkey || "(empty)"),
          el("div", { class: "gcounts" },
            `tokens: ${items.length.toLocaleString()}`,
            el("span", { class: "badge" }, `verses: ${verseSet.size.toLocaleString()}`)
          )
        ),
        el("div", {}, "▸")
      );
      const body = el("div", { class: "group-body" });

      const toggle = () => {
        const expanded = body.style.display === "block";
        if (expanded) {
          body.style.display = "none";
          head.setAttribute("aria-expanded", "false");
          head.lastChild.textContent = "▸";
        } else {
          if (!body.hasChildNodes()) {
            renderGroupBody(body, items);
          }
          body.style.display = "block";
          head.setAttribute("aria-expanded", "true");
          head.lastChild.textContent = "▾";
        }
      };
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggle();
        }
      });

      group.appendChild(head);
      group.appendChild(body);
      frag.appendChild(group);
    }

    groupsEl.appendChild(frag);
  }

  function renderGroupBody(container, items) {
    const frag = document.createDocumentFragment();

    for (const e of items) {
      const occ = el("div", { class: "occ" });

      // Row 1: token and refs
      const r1 = el("div", { class: "row" },
        el("span", { class: "tag" }, `[${e.triple}]`),
        el("span", { class: "arabic" }, e.form || "—"),
        el("span", { class: "field-label" }, "lemma:"),
        el("span", { class: "tag" }, e.lemma || "—"),
        el("span", { class: "field-label" }, "root:"),
        el("span", { class: "tag" }, e.root || "—"),
        el("span", { class: "field-label" }, "tag:"),
        el("span", { class: "tag" }, e.tag || "—"),
        el("span", { class: "field-label" }, "features:"),
        el("span", { class: "tag" }, (e.features && e.features.length ? e.features.join(",") : "—"))
      );

      // Row 2: segments
      const segs = [];
      if (e.segments.prefixes && e.segments.prefixes.length) segs.push(safeJoin(e.segments.prefixes, " + "));
      if (e.segments.stem) segs.push(e.segments.stem);
      if (e.segments.suffixes && e.segments.suffixes.length) segs.push(safeJoin(e.segments.suffixes, " + "));
      const r2 = el("div", { class: "row stack" },
        el("span", { class: "field-label" }, "segments:"),
        el("span", { class: "arabic" }, segs.length ? segs.join(" + ") : "—")
      );

      // Row 3: clickable verse ref -> inline verse
      const verseBox = el("div");
      const btn = el("button", { class: "btn" }, `Show verse ${e.s}:${e.v}`);
      btn.addEventListener("click", () => {
        if (verseBox.hasChildNodes()) {
          verseBox.innerHTML = "";
          btn.textContent = `Show verse ${e.s}:${e.v}`;
          return;
        }
        const verseText = state.verseMap.get(e.key);
        if (verseText) {
          verseBox.appendChild(el("div", { class: "verse" }, verseText));
          btn.textContent = `Hide verse ${e.s}:${e.v}`;
        } else {
          verseBox.appendChild(el("div", { class: "warn" }, `Verse ${e.s}:${e.v} not found in quraan.txt`));
        }
      });

      occ.appendChild(r1);
      occ.appendChild(r2);
      occ.appendChild(el("div", { class: "hr" }));
      occ.appendChild(el("div", { class: "row" }, btn));
      occ.appendChild(verseBox);

      frag.appendChild(occ);
    }

    container.appendChild(frag);
  }
})();
