import React, { useState, useEffect } from "react";
import { loadQacData, loadQuranText } from "./loader/qacJsonLoader";

// Utility: Remove diacritics & tatweel
const normalizeArabic = (text) => {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // Tashkeel
    .replace(/\u0640/g, ""); // Tatweel
};

// Utility: common Arabic prefixes and suffixes
const prefixes = ["ال", "و", "ف", "ب", "ك", "ل", "س"];
const suffixes = ["ه", "ها", "هم", "هن", "كما", "كم", "نا", "ي", "ك", "ا", "ان", "ون", "ين", "ات"];

export default function App() {
  const [qac, setQac] = useState([]);
  const [quran, setQuran] = useState({});
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadData() {
      const qacData = await loadQacData();
      const quranData = await loadQuranText();
      setQac(qacData);
      setQuran(quranData);
    }
    loadData();
  }, []);

  const searchWord = () => {
    if (!input.trim()) return;
    const search = input.trim();
    let matches = [];

    // Step 1: Exact match
    matches = qac.filter(entry => entry.word === search);

    // Step 2: Normalize and retry
    if (matches.length === 0) {
      const normSearch = normalizeArabic(search);
      matches = qac.filter(entry => normalizeArabic(entry.word) === normSearch);
    }

    // Step 3: Strip prefixes/suffixes and match against stem/root
    if (matches.length === 0) {
      const normSearch = normalizeArabic(search);
      let stripped = normSearch;
      prefixes.forEach(p => { if (stripped.startsWith(p)) stripped = stripped.slice(p.length); });
      suffixes.forEach(s => { if (stripped.endsWith(s)) stripped = stripped.slice(0, -s.length); });
      matches = qac.filter(entry =>
        normalizeArabic(entry.stem || "") === stripped ||
        normalizeArabic(entry.root || "") === stripped
      );
    }

    if (matches.length === 0) {
      setResult({ notFound: true });
    } else {
      // Build result object
      const first = matches[0];
      setResult({
        notFound: false,
        analysis: {
          word: first.word,
          root: first.root,
          stem: first.stem,
          pattern: first.pattern,
          pos: first.pos,
          lemma: first.lemma,
          gloss: first.gloss
        },
        occurrences: matches.map(m => `${m.sura}:${m.ayah}`)
      });
    }
  };

  const highlightWord = (word, root, stem) => {
    const letters = word.split("");
    const rootLetters = root ? root.split("") : [];
    return (
      <span>
        {letters.map((ch, i) => {
          if (rootLetters.includes(ch)) {
            return <span key={i} style={{ color: "red" }}>{ch}</span>;
          }
          return <span key={i} style={{ color: "blue" }}>{ch}</span>;
        })}
      </span>
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Arabic Word Morphology Analyzer</h1>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="أدخل الكلمة"
        style={{ fontSize: "1.2em", direction: "rtl" }}
      />
      <button onClick={searchWord} style={{ marginLeft: "10px" }}>Analyze</button>

      {result && result.notFound && <p>لم يتم العثور على الكلمة</p>}

      {result && !result.notFound && (
        <div style={{ marginTop: "20px", direction: "rtl" }}>
          <h2>التحليل</h2>
          <p><strong>الكلمة:</strong> {highlightWord(result.analysis.word, result.analysis.root, result.analysis.stem)}</p>
          <p><strong>الجذر:</strong> {result.analysis.root}</p>
          <p><strong>الجذع:</strong> {result.analysis.stem}</p>
          <p><strong>الوزن:</strong> {result.analysis.pattern}</p>
          <p><strong>النوع:</strong> {result.analysis.pos}</p>
          <p><strong>الصيغة:</strong> {result.analysis.lemma}</p>
          <p><strong>المعنى:</strong> {result.analysis.gloss}</p>

          <h3>أماكن الورود:</h3>
          <ul>
            {result.occurrences.map((ref, i) => (
              <li key={i}>
                <button onClick={() => alert(quran[ref] || "غير موجود")} style={{ cursor: "pointer" }}>
                  {ref}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
