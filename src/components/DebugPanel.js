// DebugPanel.js — live analyzer input diagnostics

import React from 'react'

export default function DebugPanel({ input, qacMap }) {
  if (!input) return null

  const normalize = str => str.normalize('NFKC')
                               .replace(/[\u0640\u200C]/g, '')     // Tatweel, ZWNJ
                               .replace(/[\u064B-\u065F]/g, '')    // Harakat

  const raw = input
  const norm = normalize(raw)
  const match = qacMap[norm] || null

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed #999', background: '#fafafa' }}>
      <strong>🧪 Analyzer Diagnostics</strong>
      <p>🔤 Raw input: <code>{raw}</code></p>
      <p>🧼 Normalized: <code>{norm}</code></p>
      <p>🟢 Match status: {match ? '✅ Found' : '❌ Not found'}</p>
      {match && (
        <pre style={{ background: '#eee', padding: '0.5rem' }}>
          {JSON.stringify(match, null, 2)}
        </pre>
      )}
    </div>
  )
}