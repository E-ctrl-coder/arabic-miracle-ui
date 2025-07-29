// src/App.jsx
import { useState, useEffect } from 'react';
import { loadQAC, loadNemlar } from './dataLoader';

export default function App() {
  const [qac, setQac]       = useState([]);
  const [nemlar, setNemlar] = useState([]);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [qacData, nemData] = await Promise.all([
          loadQAC(),
          loadNemlar()
        ]);
        setQac(qacData);
        setNemlar(nemData);
      } catch (err) {
        console.error('Data loading error:', err);
      }
    }
    fetchAll();
  }, []);

  return (
    <div>
      <h1>Corpus Comparison</h1>

      <section>
        <h2>QAC Tokens Loaded: {qac.length}</h2>
        {/* …your QAC rendering here… */}
      </section>

      <section>
        <h2>Nemlar Documents Loaded: {nemlar.length}</h2>
        <ul>
          {nemlar.map(doc => (
            <li key={doc.name}>{doc.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}