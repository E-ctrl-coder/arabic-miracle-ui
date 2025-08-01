// src/App.jsx
import React, { useState, useEffect } from "react";
import { loadQAC, loadNemlar, normalizeArabic } from "./dataLoader";
import { buildRootMap, fallbackByRoot } from "./utils/fallbackMatcher";
import WordDisplay from "./components/WordDisplay";
import "./index.css";

export default function App() {
  const [query, setQuery] = useState("");
  const [qacRes, setQacRes] = useState({ entries: [], rootIndex: {} });
  const [nemRes, setNemRes] = useState([]);
  const [verses, setVerses] = useState([]);
  const [translations, setTranslations] = useState({});
  const [error, setError] = useState("");

  // Load translations once
  useEffect(() => {
    fetch("/translations.json")
      .then((res) => res.json())
      .then(setTranslations)
      .catch(console.error);
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    console.clear();
    setError("");
    console.log("Searching for token:", query);

    try {
      const [{ entries, rootIndex }, nemEntries] = await Promise.all([
        loadQAC(),
        loadNemlar(),
      ]);

      console.log("🎯 loadQAC → entries:", entries.length);
      console.log("🎯 loadNemlar → entries:", nemEntries.length);

      const normQuery = normalizeArabic(query.trim());
      console.log("Normalized query:", normQuery);

      console.log(
        "🔍 Sample QAC normTokens:",
        entries.slice(0, 5).map((e) => e.normToken)
      );
      console.log(
        "🔍 Sample Nemlar normTokens:",
        nemEntries.slice(0, 5).map((e) => e.normToken)
      );

      const qacMatches = entries.filter((e) => e.normToken === normQuery);
      console.log("QAC token matches:", qacMatches.length);
      setQacRes({ entries: qacMatches, rootIndex });

      const rootKey = qacMatches[0]?.normRoot || "";
      console.log("Normalized root for matches:", rootKey);
      const verseList = rootKey ? rootIndex[rootKey] || [] : [];
      console.log("Verses for root:", verseList);
      setVerses(verseList);

      const nemlarRootMap = buildRootMap(nemEntries);

      const exactNemMatches = nemEntries.filter(
        (e) => e.normToken === normQuery
      );
      console.log("Nemlar token matches:", exactNemMatches.length);

      const finalNemMatches =
        exactNemMatches.length > 0
          ? exactNemMatches
          : fallbackByRoot(normQuery, nemlarRootMap);
      console.log("Nemlar fallback matches:", finalNemMatches.length);
      setNemRes(finalNemMatches);
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <form onSubmit={handleSearch} className="flex space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Arabic word"
          className="border px-2 py-1 flex-grow"
        />
        <button type="submit" className="bg-blue-600 text-white px-4">
          Analyze
        </button>
      </form>

      {error && <div className="text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* QAC Analysis */}
        <div>
          <h2 className="text-lg font-semibold mb-2">QAC Analysis</h2>
          {qacRes.entries.length === 0 && <p>No QAC matches</p>}
          {qacRes.entries.length > 0 && (
            <>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th>token</th>
                    <th>morph display</th>
                    <th>pattern</th>
                    <th>lemma</th>
                    <th>pos</th>
                  </tr>
                </thead>
                <tbody>
                  {qacRes.entries.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td>{e.token}</td>
                      <td>
                        <WordDisplay
                          tokenData={e}
                          translations={translations}
                        />
                      </td>
                      <td>{e.pattern}</td>
                      <td>{e.lemma}</td>
                      <td>{e.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="mt-4 font-semibold">Verses for Root</h3>
              {verses.length === 0 ? (
                <p>No verses found</p>
              ) : (
                <ul className="list-disc list-inside">
                  {verses.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Nemlar Analysis */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Nemlar Analysis</h2>
          {nemRes.length === 0 && <p>No Nemlar matches</p>}
          {nemRes.length > 0 && (
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th>file</th>
                  <th>sentId</th>
                  <th>morph display</th>
                  <th>pos</th>
                </tr>
              </thead>
              <tbody>
                {nemRes.map((e, i) => (
                  <tr key={i} className="border-t">
                    <td>{e.filename}</td>
                    <td>{e.sentenceId}</td>
                    <td>
                      <WordDisplay
                        tokenData={e}
                        translations={translations}
                      />
                    </td>
                    <td>{e.pos}</td>
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
