import React, { useState, useEffect } from "react";

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputWord, setInputWord] = useState("");
  const [results, setResults] = useState([]);

  // Load qac.json on mount
  useEffect(() => {
    console.log("App.jsx mounted — starting QAC load...");

    fetch("/qac.json")
      .then((res) => {
        console.log("Fetched qac.json, status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("QAC data loaded, entries:", data.length);
        setQacData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading qac.json:", err);
        setLoading(false);
      });
  }, []);

  // Search handler
  const handleSearch = () => {
    console.log("Search clicked. Input:", inputWord);
    if (!inputWord.trim()) {
      console.warn("Empty input — no search performed.");
      return;
    }

    const normalized = inputWord.trim();
    console.log("Normalized search term:", normalized);

    const matches = qacData.filter(
      (entry) =>
        entry.word === normalized ||
        entry.root === normalized ||
        entry.lemma === normalized
    );

    console.log("Matches found:", matches.length);
    setResults(matches);
  };

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading QAC data...</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>QAC Analyzer — Debug Mode</h1>
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Enter Arabic word..."
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
          style={{ fontSize: "1.2rem", padding: "0.5rem" }}
        />
        <button
          onClick={handleSearch}
          style={{
            marginLeft: "1rem",
            fontSize: "1.2rem",
            padding: "0.5rem 1rem",
          }}
        >
          Search
        </button>
      </div>

      <div>
        {results.length === 0 ? (
          <p>No results yet.</p>
        ) : (
          <ul>
            {results.map((r, i) => (
              <li key={i}>
                {r.word} — Root: {r.root} — Lemma: {r.lemma}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
