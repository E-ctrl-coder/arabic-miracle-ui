import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import {
  loadQacEntries,
  loadNemlarSentences
} from './utils/dataLoader';

if (import.meta.env.DEV) {
  // Expose loaders in DevTools for quick testing
  window.loadQAC = loadQacEntries;
  window.loadNemlar = loadNemlarSentences;
}

ReactDOM
  .createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );