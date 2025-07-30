// src/App.jsx
import React, { useState } from "react";
import { loadQAC, loadNemlar } from "./dataLoader";

export default function App() {
  const [query, setQuery] = useState("");
  const [qacMatches, setQacMatches] = useState([]);
  const [qacVerses, setQacVerses] = useState([]);
  const [nemlarMatches, setNemlarMatches] = useState([]);
  const [error, setError] = useState("");

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    try {
      // Load both corpora in parallel
      const [{ entries, rootIndex }, nemEntries] = await Promise.all([
        loadQAC(),
        loadNemlar(),
      ]);

      // Filter QAC by token and collect verses for the root
      const filteredQAC = entries.filter((e) => e.token === query);
      const root = filteredQAC[0]?.root;
      const verses = root
        ? Array.from(rootIndex[root]).sort()
        : [];

      // Filter Nemlar by token
      const filteredNem = nemEntries.filter((e) => e.token === query);

      setQacMatches(filteredQAC);
      setQacVerses(verses);
      setNemlarMatches(filteredNem);
    } catch (err) {
      console.error(err);
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
        <button
          type="submit"
          className="bg-blue-600 text-white px-4"
        >
          Analyze
        </button>
      </form>

      {error && <div className="text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* QAC Results */}
        <div>
          <h2 className="text-lg font-semibold mb-2">QAC Analysis</h2>
          {qacMatches.length === 0
            ? <p>No QAC matches</p>
            : (
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-1">token</th>
                    <th className="border px-1">prefix</th>
                    <th className="border px-1">stem</th>
                    <th className="border px-1">suffix</th>
                    <th className="border px-1">root</th>
                    <th className="border px-1">pattern</th>
                    <th className="border px-1">lemma</th>
                    <th className="border px-1">pos</th>
                  </tr>
                </thead>
                <tbody>
                  {qacMatches.map((e, i) => (
                    <tr key={i}>
                      <td className="border px-1">{e.token}</td>
                      <td className="border px-1">{e.prefix}</td>
                      <td className="border px-1">{e.stem}</td>
                      <td className="border px-1">{e.suffix}</td>
                      <td className="border px-1">{e.root}</td>
                      <td className="border px-1">{e.pattern}</td>
                      <td className="border px-1">{e.lemma}</td>
                      <td className="border px-1">{e.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }

          <h3 className="mt-4 font-semibold">Verses for Root</h3>
          {qacVerses.length === 0
            ? <p>No verses found</p>
            : (
              <ul className="list-disc list-inside">
                {qacVerses.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )
          }
        </div>

        {/* Nemlar Results */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Nemlar Analysis</h2>
          {nemlarMatches.length === 0
            ? <p>No Nemlar matches</p>
            : (
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-1">file</th>
                    <th className="border px-1">sentId</th>
                    <th className="border px-1">token</th>
                    <th className="border px-1">prefix</th>
                    <th className="border px-1">stem</th>
                    <th className="border px-1">suffix</th>
                    <th className="border px-1">root</th>
                    <th className="border px-1">pattern</th>
                    <th className="border px-1">lemma</th>
                    <th className="border px-1">pos</th>
                  </tr>
                </thead>
                <tbody>
                  {nemlarMatches.map((e, i) => (
                    <tr key={i}>
                      <td className="border px-1">{e.filename}</td>
                      <td className="border px-1">{e.sentenceId}</td>
                      <td className="border px-1">{e.token}</td>
                      <td className="border px-1">{e.prefix}</td>
                      <td className="border px-1">{e.stem}</td>
                      <td className="border px-1">{e.suffix}</td>
                      <td className="border px-1">{e.root}</td>
                      <td className="border px-1">{e.pattern}</td>
                      <td className="border px-1">{e.lemma}</td>
                      <td className="border px-1">{e.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  );
}