import React, { useState, useEffect } from "react";
import { loadQACData, normalizeArabic, stemArabic, getSurfaceForm } from "./loader/qacJsonLoader";
import "./styles.css";

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const data = await loadQACData();
        setQacData(data);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load dictionary data");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  function handleSearch() {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const normTerm = normalizeArabic(searchTerm);
    console.log("Searching for:", normTerm);

    // Exact match search
    let matches = qacData.filter(entry => {
      const surface = normalizeArabic(getSurfaceForm(entry));
      return surface === normTerm;
    });

    // Stem-based fallback search
    if (matches.length === 0) {
      const stemTerm = stemArabic(normTerm);
      matches = qacData.filter(entry => {
        const surfaceStem = stemArabic(getSurfaceForm(entry));
        return surfaceStem === stemTerm;
      });
    }

    setResults(matches);
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="app">
      <h1>Arabic Corpus Analyzer</h1>
      
      {error ? (
        <div className="error-message">{error}</div>
      ) : isLoading ? (
        <div className="loading">Loading dictionary...</div>
      ) : (
        <>
          <div className="search-box">
            <input
              type="text"
              value={searchTerm}
              placeholder="أدخل كلمة"
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              dir="rtl"
              lang="ar"
            />
            <button onClick={handleSearch}>بحث</button>
          </div>

          {results.length === 0 && searchTerm ? (
            <p>No results found for "{searchTerm}"</p>
          ) : results.length > 0 ? (
            <div className="results">
              <h2>Results ({results.length})</h2>
              <ul>
                {results.map((entry, idx) => (
                  <li key={idx}>
                    <div className="entry">
                      <span className="arabic">{getSurfaceForm(entry)}</span>
                      <div className="details">
                        <span>Root: {entry.root || "N/A"}</span>
                        <span>Lemma: {entry.lemma || "N/A"}</span>
                        <span>Tag: {entry.tag || "N/A"}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Enter a word to begin search</p>
          )}
        </>
      )}
    </div>
  );
}
