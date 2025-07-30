// src/App.jsx
import React, { useState } from "react";
import { loadQAC, loadNemlar } from "./dataLoader";

export default function App() {
  const [query, setQuery] = useState("");
  const [qacRes, setQacRes] = useState({ entries: [], rootIndex: {} });
  const [nemRes, setNemRes] = useState([]);
  const [verses, setVerses] = useState([]);
  const [error, setError] = useState("");

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

      console.log("loadQAC returned entries:", entries.length);
      console.log("loadNemlar returned entries:", nemEntries.length);

      const qacMatches = entries.filter((e) => e.token === query);
      console.log("QAC token matches:", qacMatches.length);
      setQacRes({ entries: qacMatches, rootIndex });

      const root = qacMatches[0]?.root;
      console.log("Root for matched token:", root);

      const verseList = root
        ? Array.from(rootIndex[root]).sort()
        : [];
      console.log("Verses for root:", verseList);
      setVerses(verseList);

      const nemMatches = nemEntries.filter((e) => e.token === query);
      console.log("Nemlar token matches:", nemMatches.length);
      setNemRes(nemMatches);
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
        <div>
          <h2 className="text-lg font-semibold mb-2">QAC Analysis</h2>
          {qacRes.entries.length === 0 && <p>No QAC matches</p>}
          {qacRes.entries.length > 0 && (
            <>
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th>token</th>
                    <th>prefix</th>
                    <th>stem</th>
                    <th>suffix</th>
                    <th>root</th>
                    <th>pattern</th>
                    <th>lemma</th>
                    <th>pos</th>
                  </tr>
                </thead>
                <tbody>
                  {qacRes.entries.map((e, i) => (
                    <tr key={i}>
                      <td>{e.token}</td>
                      <td>{e.prefix}</td>
                      <td>{e.stem}</td>
                      <td>{e.suffix}</td>
                      <td>{e.root}</td>
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

        <div>
          <h2 className="text-lg font-semibold mb-2">Nemlar Analysis</h2>
          {nemRes.length === 0 && <p>No Nemlar matches</p>}
          {nemRes.length > 0 && (
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th>file</th>
                  <th>sentId</th>
                  <th>token</th>
                  <th>prefix</th>
                  <th>stem</th>
                  <th>suffix</th>
                  <th>root</th>
                  <th>pattern</th>
                  <th>lemma</th>
                  <th>pos</th>
                </tr>
              </thead>
              <tbody>
                {nemRes.map((e, i) => (
                  <tr key={i}>
                    <td>{e.filename}</td>
                    <td>{e.sentenceId}</td>
                    <td>{e.token}</td>
                    <td>{e.prefix}</td>
                    <td>{e.stem}</td>
                    <td>{e.suffix}</td>
                    <td>{e.root}</td>
                    <td>{e.pattern}</td>
                    <td>{e.lemma}</td>
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