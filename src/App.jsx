import { useState } from "react";
import "./index.css";

function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("https://arabic-miracle-api.onrender.com/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ word })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data.result);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>🔍 Arabic Miracle Word Analyzer</h1>
      <input
        type="text"
        placeholder="اكتب الكلمة هنا"
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <button onClick={handleAnalyze} disabled={loading || !word.trim()}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>

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
