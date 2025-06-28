// src/Analyzer.jsx
import React, { useState } from "react";
import { analyzeWord } from "./api";

export default function Analyzer() {
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      console.clear();
      console.log("🔎 Running analysis for:", word);
      const data = await analyzeWord(word);
      console.log("✅ Analysis result:", data);
      setResult(data);
    } catch (e) {
      console.error("🔥 Analysis error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        className="border p-2 w-full"
        placeholder="أدخل كلمة عربية"
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <button
        onClick={runAnalysis}
        disabled={loading || !word.trim()}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Analyze"}
      </button>

      {error && <div className="text-red-600">Error: {error}</div>}

      {result && (
        <div className="bg-gray-50 p-4 rounded space-y-2">
          <div><strong>Word:</strong> {result.word}</div>
          <div><strong>Root:</strong> {result.root}</div>
          <div><strong>Pattern:</strong> {result.pattern}</div>
          <div><strong>POS:</strong> {result.pos}</div>
          <div><strong>Translation:</strong> {result.translation}</div>
          <div><strong>Occurrences:</strong> {result.occurrence_count}</div>

          <div className="space-y-2 mt-2">
            {result.quran_occurrences.map((occ, i) => (
              <div key={i}>
                <div><em>Surah {occ.surah}, Ayah {occ.ayah}</em></div>
                <div
                  dangerouslySetInnerHTML={{ __html: occ.text }}
                  className="text-lg"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
