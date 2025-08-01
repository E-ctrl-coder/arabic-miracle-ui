import React, { useState, useEffect } from "react";
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
      .then(r => r.json())
      .then(setTranslations)
      .catch(console.error);
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    console.clear();

    const [qac, nem] = await Promise.all([loadQAC(), loadNemlar()]);
    setQacEntries(qac.entries);
    setQacRootIndex(qac.rootIndex);
    setNemTokenIndex(nem.tokenIndex);
    setNemRootIndex(nem.rootIndex);

    const norm = normalizeArabic(e?.target?.elements?.query?.value ?? "");
    if (!norm) {
      setQacMatches([]); setNemlarMatches([]); setVerses([]); return;
    }

    const qMatches = qac.entries.filter(x => x.normToken === norm);
    setQacMatches(qMatches);
    const root = qMatches[0]?.normRoot || "";
    const verseList = root ? (qac.rootIndex[root] || []) : [];
    setVerses(verseList);

    const exactNem = nem.tokenIndex[norm] ?? [];
    const fallNem = nem.rootIndex[norm] ?? [];
    setNemlarMatches(exactNem.length ? exactNem : fallNem);
  };

  return (
    <div className="p-6 space-y-6">
      <form onSubmit={handleSearch} className="input-container">
        <input name="query" placeholder="أدخل كلمة عربية" />
        <button type="submit">تحليل Analyze</button>
      </form>

      <div className="corpus-comparison">
        <div className="corpus-column">
          <h2>QAC Analysis</h2>
          {qacMatches.length === 0 ? <p>لا توجد نتائج QAC</p> :
            <>
              <table><thead>
                <tr><th>Token</th><th>Display</th><th>Pattern</th><th>Lemma</th><th>POS</th></tr>
              </thead><tbody>
                {qacMatches.map((e,i) =>
                  <tr key={i}>
                    <td>{e.token}</td>
                    <td><WordDisplay tokenData={e} translations={translations} /></td>
                    <td>{e.pattern}</td>
                    <td>{e.lemma}</td>
                    <td>{e.pos}</td>
                  </tr>
                )}
              </tbody></table>
              <h3>Verses for root</h3>
              {verses.length === 0 ? <p>No verses</p> : <ul>{verses.map((v,i)=><li key={i}>{v}</li>)}</ul>}
            </>
          }
        </div>

        <div className="corpus-column">
          <h2>NEMLAR Analysis</h2>
          {nemlarMatches.length === 0 ? <p>No Nemlar matches</p> :
            <table><thead>
              <tr><th>File</th><th>Sentence ID</th><th>Display</th><th>POS</th></tr>
            </thead><tbody>
              {nemlarMatches.map((e,i) =>
                <tr key={i}>
                  <td>{e.filename}</td>
                  <td>{e.sentenceId}</td>
                  <td><WordDisplay tokenData={e} translations={translations} /></td>
                  <td>{e.pos}</td>
                </tr>
              )}
            </tbody></table>
          }
        </div>
      </div>
    </div>
  );
}
