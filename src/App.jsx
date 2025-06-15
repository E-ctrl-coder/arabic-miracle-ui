import React, { useState } from "react";

function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!word.trim()) {
      setError("Please enter a word.");
      setResult("");
      return;
    }

    setLoading(true);
    setResult("");
    setError("");

    try {
      const response = await fetch("https://arabic-miracle-api.onrender.com/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word }),
      });

      const data = await response.json();

      if (response.ok && data.result) {
        setResult(data.result);
      } else if (data.error) {
        setError("Error: " + data.error);
      } else {
        setError("Unexpected response.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20, fontFamily: "Arial" }}>
      <h1>🔍 Arabic Word Analyzer</h1>

      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Enter Arabic word"
        style={{ padding: 10, width: "100%", fontSize: 16, marginBottom: 10 }}
      />

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          padding: 10,
          fontSize: 16,
          width: "100%",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {error && (
        <div style={{ color: "red", marginTop: 20 }}>
          <strong>{error}</strong>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, whiteSpace: "pre-wrap", background: "#f8f8f8", padding: 15 }}>
          {result}
        </div>
      )}
    </div>
  );
}

export default App;

