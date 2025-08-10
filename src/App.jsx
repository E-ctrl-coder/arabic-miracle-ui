import React, { useState, useEffect } from "react";
import { loadQACData, searchWordInQAC } from "./loader/qacJsonLoader";
import { normalizeArabic } from "./utils/normalizeArabic";

export default function App() {
  const [word, setWord] = useState("");
  const [results, setResults] = useState([]);
  const [verses, setVerses] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const qacData = await loadQACData();
    const matches = searchWordInQAC(word, qacData);
    setResults(matches);
    setLoading(false);
  };

  const loadVerse = async (sura, ayah) => {
    const response = await fetch("/quraan.txt");
    const text = await response.text();
    const lines = text.split("\n");
    const verseText = lines.find(line => line.startsWith(`${sura}|${ayah}|`));
    if (verseText) {
      const parts = verseText.split("|");
      setVerses(prev => ({ ...prev, [`${sura}:${ayah}`]: parts[2] }));
    }
  };

  return (
    <div className="container">
      <h1>Arabic Word Morphology Analyzer</h1>
      <div className="search-bar">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="أدخل كلمة عربية"
        />
        <button onClick={handleSearch} disabled={!word}>
          بحث
        </button>
      </div>

      {loading && <p>جارٍ البحث...</p>}

      {results.length > 0 && (
        <div className="results">
          {results.map((res, idx) => (
            <div key={idx} className="result-card">
              <p><strong>الكلمة:</strong> {res.word}</p>
              <p><strong>الجذر:</strong> <span className="root">{res.root}</span></p>
              <p><strong>الوزن:</strong> {res.pattern}</p>
              <p><strong>النوع:</strong> {res.pos}</p>
              <p><strong>المعنى:</strong> {res.meaning || "—"}</p>
              <div className="occurrences">
                <strong>التكرار:</strong>
                <ul>
                  {res.occurrences.map((occ, i) => (
                    <li key={i}>
                      <button
                        onClick={() => loadVerse(occ.sura, occ.ayah)}
                        className="verse-btn"
                      >
                        {occ.sura}:{occ.ayah}
                      </button>
                      {verses[`${occ.sura}:${occ.ayah}`] && (
                        <span className="verse-text">
                          {verses[`${occ.sura}:${occ.ayah}`]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
