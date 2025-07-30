// src/App.jsx
import React, { useEffect, useState } from "react";
import { loadCorpora } from "./dataLoader";

export default function App() {
  const [data, setData] = useState(null);
  const [word, setWord] = useState("");
  const [result, setResult] = useState({ qac: null, nemlar: [] });
  const [error, setError] = useState("");

  // Load corpora on mount
  useEffect(() => {
    loadCorpora()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  // Trigger analysis when user clicks
  function analyze() {
    if (!data || !word.trim()) return;

    // QAC: first match on token
    const qacMatch = data.qacEntries.find((e) => e.token === word);
    const verses = qacMatch
      ? Array.from(data.rootIndex[qacMatch.root])
      : [];

    // Nemlar: all matches on token
    const nemlarMatches = data.nemlarEntries.filter((e) => e.token === word);

    setResult({ qac: qacMatch ? { ...qacMatch, verses } : null, nemlar: nemlarMatches });
  }

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }
  if (!data) {
    return <div>Loading corpora…</div>;
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h1>Arabic Morphological Analyzer</h1>

      <div style={{ margin: "1rem 0" }}>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter Arabic word"
          style={{ fontSize: "1.1rem", padding: "0.5rem", width: "300px" }}
        />
        <button
          onClick={analyze}
          style={{ marginLeft: "0.5rem", padding: "0.5rem 1rem" }}
        >
          Analyze
        </button>
      </div>

      {/* QAC Result */}
      {result.qac && (
        <section style={{ marginBottom: "2rem" }}>
          <h2>QAC Analysis</h2>
          <table>
            <tbody>
              <tr><th>Prefix</th><td>{result.qac.prefix}</td></tr>
              <tr><th>Stem</th><td>{result.qac.stem}</td></tr>
              <tr><th>Suffix</th><td>{result.qac.suffix}</td></tr>
              <tr><th>Root</th><td>{result.qac.root}</td></tr>
              <tr><th>Pattern</th><td>{result.qac.pattern}</td></tr>
              <tr><th>Lemma</th><td>{result.qac.lemma}</td></tr>
              <tr><th>POS</th><td>{result.qac.pos}</td></tr>
            </tbody>
          </table>
          <p>
            Root appears in verses:{" "}
            {result.qac.verses.length > 0
              ? result.qac.verses.join(", ")
              : "none found"}
          </p>
        </section>
      )}

      {/* Nemlar Results */}
      {result.nemlar.length > 0 && (
        <section>
          <h2>
            Nemlar Analysis ({result.nemlar.length} match
            {result.nemlar.length > 1 ? "es" : ""})
          </h2>
          {result.nemlar.map((e, i) => (
            <div key={i} style={{ marginBottom: "1rem" }}>
              <strong>
                {e.filename} – sentence {e.sentenceId}
              </strong>
              <table>
                <tbody>
                  <tr><th>Prefix</th><td>{e.prefix}</td></tr>
                  <tr><th>Stem</th><td>{e.stem}</td></tr>
                  <tr><th>Suffix</th><td>{e.suffix}</td></tr>
                  <tr><th>Root</th><td>{e.root}</td></tr>
                  <tr><th>Pattern</th><td>{e.pattern}</td></tr>
                  <tr><th>Lemma</th><td>{e.lemma}</td></tr>
                  <tr><th>POS</th><td>{e.pos}</td></tr>
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}