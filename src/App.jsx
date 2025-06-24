import { useState } from "react";

function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeWord = async () => {
    setError("");
    if (!word.trim()) {
      setError("Please enter an Arabic word.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        "https://arabic-miracle-api.onrender.com/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ word }),
        }
      );

      if (!response.ok) {
        throw new Error("Server error: " + response.status);
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Failed to fetch: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Arabic Miracle Word Analyzer</h1>

      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="اكتب كلمة عربية"
        style={{ fontSize: 18, padding: 8, width: "100%" }}
      />

      <button
        onClick={analyzeWord}
        disabled={loading}
        style={{ marginTop: 10, padding: "8px 16px", fontSize: 18 }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20, textAlign: "right", direction: "rtl" }}>
          <h2>نتيجة التحليل</h2>

          <p>
            <b>الكلمة مع تلوين الجذر والزوائد:</b>{" "}
            <span dangerouslySetInnerHTML={{ __html: result.word_colored }} />
          </p>

          <p>
            <b>الجذر العربي:</b>{" "}
            <span
              dangerouslySetInnerHTML={{
                __html: result.root_ar.split(" ").map((c) =>
                  `<span class="root">${c}</span>`
                ).join(" "),
              }}
            />
            <br />
            <b>الترجمة الإنجليزية للجذر:</b> {result.root_en}
          </p>

          <p>
            <b>الترجمة الإنجليزية للكلمة:</b> {result.word_en}
          </p>

          <p>
            <b>الوزن الصرفي:</b> {result.scale} <br />
            <b>نوع الوزن:</b> {result.scale_type}
          </p>

          <p>
            <b>عدد مرات ظهور الجذر في القرآن:</b> {result.root_occurrences}
          </p>

          <h3>الآيات التي تحتوي الجذر:</h3>
          {result.verses.map((verse, i) => (
            <p
              key={i}
              style={{ border: "1px solid #ccc", padding: 10, borderRadius: 6 }}
              dangerouslySetInnerHTML={{ __html: verse }}
            />
          ))}
        </div>
      )}

      <style>{`
        .root {
          color: red;
          font-weight: bold;
        }
        .prefix {
          color: blue;
        }
        .suffix {
          color: green;
        }
        .extra {
          color: orange;
        }
      `}</style>
    </div>
  );
}

export default App;
