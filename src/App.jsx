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
      .then((res) => res.json())
      .then(setTranslations)
      .catch(console.error);
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    console.clear();

    const query = e.target.query.value.trim();
    const normalized = normalizeArabic(query);
    if (!normalized) {
      setQacMatches([]);
      setNemlarMatches([]);
      setVerses([]);
      return;
    }

    const [qac, nem] = await Promise.all([loadQAC(), loadNemlar()]);
    setQacEntries(qac.entries);
    setQacRootIndex(qac.rootIndex);
    setNemTokenIndex(nem.tokenIndex);
    setNemRootIndex(nem.rootIndex);

    const qacFiltered = qac.entries.filter((e) => e.normToken === normalized);
    setQacMatches(qacFiltered);

    const root = qacFiltered[0]?.normRoot || "";
    setVerses(root ? qac.rootIndex[root] || [] : []);

    const exactNem = nem.tokenIndex[normalized] || [];
    const fallbackNem = nem.rootIndex[normalized] || [];
    setNemlarMatches(exactNem.length > 0 ? exactNem : fallbackNem);
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
          {qacMatches.length === 0 ? (
            <p>لا توجد نتائج QAC</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Display</th>
                    <th>Pattern</th>
                    <th>Lemma</th>
                    <th>POS</th>
                  </tr>
                </thead>
                <tbody>
                  {qacMatches.map((entry, i) => (
                    <tr key={i}>
                      <td>{entry.token}</td>
                      <td>
                        <WordDisplay tokenData={entry} translations={translations} />
                      </td>
                      <td>{entry.pattern}</td>
                      <td>{entry.lemma}</td>
                      <td>{entry.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Verses for root</h3>
              {verses.length === 0 ? (
                <p>No verses found</p>
              ) : (
                <ul>
                  {verses.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="corpus-column">
          <h2>NEMLAR Analysis</h2>
          {nemlarMatches.length === 0 ? (
            <p>No NEMLAR matches</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Sentence ID</th>
                  <th>Display</th>
                  <th>POS</th>
                </tr>
              </thead>
              <tbody>
                {nemlarMatches.map((entry, i) => (
                  <tr key={i}>
                    <td>{entry.filename}</td>
                    <td>{entry.sentenceId}</td>
                    <td>
                      <WordDisplay tokenData={entry} translations={translations} />
                    </td>
                    <td>{entry.pos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
