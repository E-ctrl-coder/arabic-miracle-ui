// src/App.jsx
import React, { useState, useEffect, useMemo } from "react";
import { loadQAC, loadNemlar, normalizeArabic } from "./utils/dataLoader";
import { FixedSizeList } from "react-window";
import WordDisplay from "./components/WordDisplay";
import "./style.css";

export default function App() {
  const [qac, setQac]     = useState(null);
  const [nem, setNem]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [qacMatches, setQacMatches] = useState([]);
  const [nemMatches, setNemMatches] = useState([]);
  const [verses, setVerses]         = useState([]);

  useEffect(() => {
    Promise.all([loadQAC(), loadNemlar()])
      .then(([qData, nData]) => {
        setQac(qData);
        setNem(nData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = e => {
    e.preventDefault();
    const raw  = query.trim();
    const norm = normalizeArabic(raw);
    if (!norm || loading) {
      setQacMatches([]);
      setNemMatches([]);
      setVerses([]);
      return;
    }

    let qlist = qac.tokenIndex[norm] || [];
    if (!qlist.length) {
      const stripped = normalizeArabic(raw.replace(/^ال/, ""));
      qlist = qac.rootIndex[stripped]
        ?.map(loc => qac.entries.find(e => e.location === loc))
        || [];
    }
    setQacMatches(qlist);
    setVerses(qlist[0]?.normRoot ? qac.rootIndex[qlist[0].normRoot] : []);

    const nlist = nem.tokenIndex[norm] || nem.rootIndex[norm] || [];
    setNemMatches(nlist);
  };

  const QACList = useMemo(() => (
    <FixedSizeList
      height={300}
      width="100%"
      itemCount={qacMatches.length}
      itemSize={35}
      style={{ overflowX: "hidden" }}
    >
      {({ index, style }) => {
        const e = qacMatches[index];
        return (
          <div style={style} className="row">
            <span>{e.token}</span>
            <WordDisplay tokenData={e} />
            <span>{e.pattern}</span>
            <span>{e.lemma}</span>
            <span>{e.pos}</span>
          </div>
        );
      }}
    </FixedSizeList>
  ), [qacMatches]);

  const NemList = useMemo(() => (
    <FixedSizeList
      height={300}
      width="100%"
      itemCount={nemMatches.length}
      itemSize={35}
      style={{ overflowX: "hidden" }}
    >
      {({ index, style }) => {
        const e = nemMatches[index];
        return (
          <div style={style} className="row">
            <span>{e.filename}</span>
            <span>{e.sentenceId}</span>
            <WordDisplay tokenData={e} />
            <span>{e.pos}</span>
          </div>
        );
      }}
    </FixedSizeList>
  ), [nemMatches]);

  return (
    <div className="app">
      <h1>Arabic Morphology Analyzer</h1>
      <form onSubmit={handleSearch} className="input-form">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="أدخل كلمة عربية"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          Analyze
        </button>
      </form>

      {loading && <p>Loading corpora…</p>}

      {!loading && (
        <div className="results">
          <div className="column">
            <h2>QAC</h2>
            {qacMatches.length ? QACList : <p>No QAC matches</p>}
            <h3>Verses</h3>
            {verses.length
              ? <ul>{verses.map(v => <li key={v}>{v}</li>)}</ul>
              : <p>No verses found</p>}
          </div>
          <div className="column">
            <h2>NEMLAR</h2>
            {nemMatches.length ? NemList : <p>No NEMLAR matches</p>}
          </div>
        </div>
      )}
    </div>
  );
}