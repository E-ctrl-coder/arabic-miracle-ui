// src/App.jsx
import React, { useState, useEffect } from 'react';
import { loadQAC, loadNemlar } from './dataLoader';
import { FixedSizeList as List } from 'react-window';
import ContentLoader from 'react-content-loader';

function SkeletonList() {
  return (
    <ContentLoader
      speed={2}
      width="100%"
      height={600}
      backgroundColor="#f3f3f3"
      foregroundColor="#ecebeb"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={i} x="0" y={i * 30} rx="3" ry="3" width="100%" height="20" />
      ))}
    </ContentLoader>
  );
}

function QACTokensList({ tokens }) {
  return (
    <List
      height={600}
      itemCount={tokens.length}
      itemSize={24}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style} className="px-2" key={index}>
          {tokens[index].surface}
        </div>
      )}
    </List>
  );
}

function NemlarDocsList({ docs }) {
  return (
    <ul className="space-y-4 overflow-auto h-[600px]">
      {docs.map((doc, idx) => (
        <li key={idx} className="p-2 border rounded">
          <h3 className="font-medium mb-1">{doc.name}</h3>
          <pre className="text-xs whitespace-pre-wrap">
            {doc.text.slice(0, 300)}...
          </pre>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [qacTokens, setQacTokens] = useState(null);
  const [nemlarDocs, setNemlarDocs] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const [tokens, docs] = await Promise.all([
        loadQAC(),
        loadNemlar(),
      ]);
      setQacTokens(tokens);
      setNemlarDocs(docs);
    }
    fetchData();
  }, []);

  return (
    <div className="flex space-x-4 p-4">
      <div className="w-1/2">
        <h2 className="text-xl font-semibold mb-2">QAC Tokens</h2>
        {qacTokens === null
          ? <SkeletonList />
          : <QACTokensList tokens={qacTokens} />}
      </div>
      <div className="w-1/2">
        <h2 className="text-xl font-semibold mb-2">Nemlar Documents</h2>
        {nemlarDocs === null
          ? <SkeletonList />
          : <NemlarDocsList docs={nemlarDocs} />}
      </div>
    </div>
  );
}