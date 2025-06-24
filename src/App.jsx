import React, { useState } from "react";
import "./App.css";

function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setResult("");
    setError("");

    if (!word.trim()) {
      setError("⚠️ الرجاء إدخال كلمة عربية");
      return;
    }

    try {
      const response = await fetch("https://arabic-miracle-api.onrender.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data.result);
      } else {
        setError(data.error || "حدث خطأ غير متوقع");
      }
    } catch (err) {
      setError("❌ تعذر الاتصال بالخادم. تحقق من الاتصال أو الرابط.");
    }
  };

  return (
    <div className="App">
      <h1>🔍 Arabic Miracle Word Analyzer</h1>
      <input
        type="text"
        value={word}
        placeholder="أدخل كلمة عربية مثل: كتبوا"
        onChange={(e) => setWord(e.target.value)}
      />
      <button onClick={handleAnalyze}>تحليل</button>

      {error && <div className="error">{error}</div>}
      {result && (
        <div
          className="result"
          dangerouslySetInnerHTML={{ __html: result }}
        />
      )}
    </div>
  );
}

export default App;
