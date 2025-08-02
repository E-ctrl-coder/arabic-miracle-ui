import React, { useState, useEffect, useMemo } from "react";
import { FixedSizeList } from "react-window";
import { loadQAC, loadNemlar, normalizeArabic } from "./dataLoader";
import WordDisplay from "./components/WordDisplay";
import "./index.css";

export default function App() {
  const [translations, setTranslations] = useState({});
  const [qacEntries, setQacEntries] = useState([]);
  const [qacRootIndex, setQacRootIndex] = useState({});
  const [nemTokenIndex, setNemTokenIndex] = useState({});
  const [nemRootIndex, setNemRootIndex] = useState({});
  const [qacMatches, setQacMatches] = useState([]);
  const [nemlarMatches, setNemlarMatches] = useState([]);
  const [verses, setVerses] = useState([]);

  useEffect(() => {
    fetch((process.env.PUBLIC_URL || "") + "/translations.json")
      .then((r) => r.json())
      .then(setTranslations)
      .catch(console.error);

    loadQAC().then(({ entries, rootIndex }) => {
      setQacEntries(entries);
      setQacRootIndex(rootIndex);
    });

    loadNemlar().then(({ tokenIndex, rootIndex }) => {
      setNemTokenIndex(tokenIndex);
      setNemRootIndex(rootIndex);
    });
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    console.clear();
    const raw = e.target.query.value.trim();
    const norm = normalizeArabic(raw);
    if (!norm) {
      setQacMatches([]);
      setNemlarMatches([]);
      setVerses([]);
      return;
    }

    const qlist = qacEntries.filter((e) => e.normToken === norm);
    setQacMatches(qlist);
    const root = qlist[0]?.normRoot;
    setVerses(root ? (qacRootIndex[root] || []) : []);

    const exact = nemTokenIndex[norm] || [];
    const fallback = nemRootIndex[norm] || [];
    setNemlarMatches(exact.length ? exact : fallback);
  };

  const QACList = useMemo(
    () => (
      <FixedSizeList
        height={400}
        itemCount={qacMatches.length}
        itemSize={35}
        width="100%"
      >
        {({ index, style }) => {
          const e = qacMatches[index];
          return (
            <div style={style} className="table-row">
              <span>{e.token}</span>
              <WordDisplay tokenData={e} translations={translations} />
              <span>{e.pattern}</span>
              <span>{e.lemma}</span>
              <span>{e.pos}</span>
            </div>
          );
        }}
      </FixedSizeList>
    ),
    [qacMatches, translations]
  );

  const NemList = useMemo(
    () => (
      <FixedSizeList
        height={400}
        itemCount={nemlarMatches.length}
        itemSize={35}
        width="100%"
      >
        {({ index, style }) => {
          const e = nemlarMatches[index];
          return (
            <div style={style} className="table-row">
              <span>{e.filename}</span>
              <span>{e.sentenceId}</span>
              <WordDisplay tokenData={e} translations={translations} />
              <span>{e.pos}</span>
            </div>
          );
        }}
      </FixedSizeList>
    ),
    [nemlarMatches, translations]
  );

  return (
    <div className="p-6">
      <form onSubmit={handleSearch} className="input-container">
        <input name="query" placeholder="أدخل كلمة عربية" />
        <button type="submit">تحليل / Analyze</button>
      </form>

      <div className="corpus-comparison">
        <div className="corpus-column">
          <h2>QAC Analysis</h2>
          {qacMatches.length === 0 ? <p>No QAC matches</p> : QACList}
          <h3>Verses for Root</h3>
          <ul>{verses.map((v, i) => <li key={i}>{v}</li>)}</ul>
        </div>

        <div className="corpus-column">
          <h2>NEMLAR Analysis</h2>
          {nemlarMatches.length === 0 ? <p>No NEMLAR matches</p> : NemList}
        </div>
      </div>
    </div>
  );
}
