// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { getMatches } from './utils/dataLoader';

if (import.meta.env.DEV) {
  // Expose getMatches in the console for quick testing
  window.getMatches = getMatches;
}

ReactDOM
  .createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );