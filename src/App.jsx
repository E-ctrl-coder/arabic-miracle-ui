import React, { useState, useEffect, useMemo } from "react";
import { FixedSizeList } from "react-window";
import {
  loadQAC,
  loadNemlar,
  normalizeArabic,
  buckwalterToArabic
} from "./dataLoader";
import { buildRootMap, fallbackByRoot } from "./utils/fallbackMatcher";
import WordDisplay from "./components/WordDisplay";
import "./index.css";

export default function App() {
  const [translations, setTranslations] = useState({});
  const [qacEntries, setQacEntries] = useState([]);
  const [nemEntries, setNemEntries] = useState([]);
  const [nemTokenIndex, setNemTokenIndex] = useState({});
  const [qacMatches, setQacMatches] = useState([]);
  const [nemMatches, setNemMatches] = useState([]);
  const [verses, setVerses] = useState([]);

  // One-time loading of corpora
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL || ""}/translations.json`)
      .then(r => r.json())
      .then(setTranslations)
      .catch(console.error);

    loadQAC()
      .then(({ entries }) => setQacEntries(entries))
      .catch(console.error);

    loadNemlar()
      .then(({ entries, tokenIndex }) => {
        setNemEntries(entries);
        setNemTokenIndex(tokenIndex);
      })
      .catch(console.error);
  }, []);

  const handleSearch = async e => {
    e.preventDefault();
    console.clear();
    const raw = e.target.query.value.trim();
    const norm = normalizeArabic(raw);
    if (!norm) {
      setQacMatches([]);
      setNemMatches([]);
      setVerses([]);
      return;
    }

    // --- QAC Matches ---
    // 1. Exact surface match
    let qlist = qacEntries.filter(e => e.normToken === norm);

    // 2. Fallback by stripping "ال" or particles if no QAC matches
    if (!qlist.length) {
      const stripped = normalizeArabic(raw.replace(/^ال/, ""));
      qlist = qacEntries.filter(e => e.normRoot === stripped);
    }

    setQacMatches(qlist);

    // Build verses list by root normalization
    const rootNorm = qlist[0]?.normRoot;
    setVerses(rootNorm
      ? (qlist.length ? [...new Set(qlist.map(e => e.location))] : [])
      : []);

    // --- NEMLAR Matches ---
    const rootMap = buildRootMap(nemEntries);
    const exact = nemTokenIndex[norm] || [];
    const fallback = fallbackByRoot(raw, rootMap);
    setNemMatches(exact.length ? exact : fallback);
  };

  const QACList = useMemo(() => (
    <FixedSizeList
      height={400}
      width="100%"
      itemCount={qacMatches.length}
      itemSize={35}
      style={{ overflowX: "hidden" }}
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
  ), [qacMatches, translations]);

  const NemList = useMemo(() => (
    <FixedSizeList
      height={400}
      width="100%"
      itemCount={nemMatches.length}
      itemSize={35}
      style={{ overflowX: "hidden" }}
    >
      {({ index, style }) => {
        const e = nemMatches[index];
        return (
          <div style={style} className="table-row">
            <span>{e.filename}</span>
            <span>{e.sentenceId}</span>
            {/** Provide full surface if `stem` is empty **/}
            <WordDisplay tokenData={{
              prefix: e.prefix,
              stem: e.stem || e.token.replace(e.prefix || "", ""),
              suffix: e.suffix
            }} translations={translations}/>
            <span>{e.pos}</span>
          </div>
        );
      }}
    </FixedSizeList>
  ), [nemMatches, translations]);

  return (
    <div className="p-6">
      <form onSubmit={handleSearch} className="input-container">
        <input name="query" placeholder="أدخل كلمة عربية"/>
        <button type="submit">تحليل / Analyze</button>
      </form>

      <div className="corpus-comparison">
        <div className="corpus-column">
          <h2>QAC Analysis</h2>
          {qacMatches.length ? QACList : <p>No QAC matches</p>}
          <h3>Verses for Root</h3>
          {verses.length ? (
            <ul>{verses.map((v,i)=><li key={i}>{v}</li>)}</ul>
          ) : <p>No verses found</p>}
        </div>
        <div className="corpus-column">
          <h2>NEMLAR Analysis</h2>
          {nemMatches.length ? NemList : <p>No NEMLAR matches</p>}
        </div>
      </div>
    </div>
  );
}
