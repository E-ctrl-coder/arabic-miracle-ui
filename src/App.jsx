import React, { useState } from "react";

function App() {
  // 1) Component state
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2) Analyze handler
  const analyze = () => {
    // clear previous states
    setError("");
    setResult(null);
    setLoading(true);

    fetch("https://arabic-miracle-api.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: inputValue })
    })
      .then((res) => {
        setLoading(false);
        if (!res.ok) {
          // non-200 status codes end up here
          throw new Error(`Server returned ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        console.log("API response:", json);
        setResult(json);
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
        setError("Sorry, could not analyze that word.");
      });
  };

  // 3) UI rendering
  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>Arabic Word Analyzer</h2>

      <input
        type="text"
        placeholder="Enter an Arabic word"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", fontSize: "1rem" }}
      />

      <button
        onClick={analyze}
        style={{ marginTop: "1rem", padding: "0.5rem 1rem", fontSize: "1rem" }}
      >
        Analyze
      </button>

      {loading && <p>Loading…</p>}

      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem", lineHeight: 1.5 }}>
          <h3>Result for "{result.word}"</h3>
          <p>
            <strong>Root:</strong> {result.data.root}
          </p>
          <p>
            <strong>Lemma:</strong> {result.data.lemma}
          </p>
          <p>
            <strong>Pattern:</strong> {result.data.pattern}
          </p>
          {result.data.prefix && (
            <p>
              <strong>Prefix:</strong> {result.data.prefix}
            </p>
          )}
          {result.data.suffix && (
            <p>
              <strong>Suffix:</strong> {result.data.suffix}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
