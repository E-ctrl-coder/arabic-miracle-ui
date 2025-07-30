import React, { useEffect, useState } from "react";
import { loadCorpora } from "./dataLoader";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCorpora()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }
  if (!data) {
    return <div>Loading corpora…</div>;
  }

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      <section style={{ flex: 1 }}>
        <h2>QAC Corpus</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {data.qacText}
        </pre>
      </section>

      <section style={{ flex: 1 }}>
        <h2>Nemlar Corpus</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data.nemlarData, null, 2)}
        </pre>
      </section>
    </div>
  );
}