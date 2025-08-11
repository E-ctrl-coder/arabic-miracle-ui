import React, { useState, useEffect } from "react";
import { loadQACData, normalizeArabic, stemArabic } from "./loader/qacJsonLoader";
import "./styles.css";

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    async function init() {
      const data = await loadQACData();
      setQacData(data);
    }
    init();
  }, []);

  function handleSearch() {
    console.log("Search clicked. Input:", searchTerm);

    const normTerm = normalizeArabic(searchTerm);
    console.log("Normalized search term:", normTerm);

    if (!normTerm) {
      setResults([]);
      return;
    }

    // First pass: exact match
    let matches = qacData.filter(entry => {
      const surface = normalizeArabic(entry.word || entry[0]);
      return surface === normTerm;
    });

    // Second pass: match by stem
    if (matches.length === 0) {
      const stemTerm = stemArabic(normTerm);
      matches = qacData.filter(entry => {
        const surfaceStem = stemArabic(entry.word || entry[0]);
        return surfaceStem === stemTerm;
      });
    }

    console.log(`Matches found: ${matches.length}`);
    setResults(matches);
  }

  return (
    <div className="app">
      <h1>AC Analyzer — Normalized Search</h1>
      <input
        type="text"
        value={searchTerm}
        placeholder="أدخل كلمة"
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>

      {results.length === 0 ? (
        <p>No results yet.</p>
      ) : (
        <ul>
          {results.map((r, idx) => (
            <li key={idx}>{r.word || r[0]}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
