import React, { useState } from "react";
import axios from "axios";

function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setResult("");
    
    // Debug: Log the trimmed word before sending
    console.log("Sending text:", word.trim());
    
    try {
      const response = await axios.post(
        "https://arabic-miracle-api.onrender.com/analyze",
        { text: word.trim() } // Ensure the payload key is "text"
      );
      
      // Check for "analysis" in the returned data
      if (response.data.analysis) {
        setResult(response.data.analysis);
      } else {
        setError("No analysis returned.");
      }
    } catch (err) {
      setError("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6 text-blue-700">
        Arabic Miracle Word Analyzer
      </h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="أدخل كلمة عربية"
          className="border border-gray-300 p-2 rounded w-80 text-right focus:outline-none focus:ring focus:border-blue-400"
          dir="rtl"
        />
        <button
          onClick={handleAnalyze}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Analyze
        </button>
      </div>

      {loading && <p className="text-gray-500">Analyzing...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {result && (
        <div
          className="bg-white shadow-lg p-6 rounded-lg max-w-2xl w-full text-right space-y-4 text-lg leading-loose border border-gray-200"
          dangerouslySetInnerHTML={{ __html: result }}
          dir="rtl"
        />
      )}
    </div>
  );
}

export default App;
