// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

// import Tailwind + your custom styles
import './index.css';

import App from './App';
import { loadQAC, loadNemlar } from './dataLoader';

// Expose loaders globally in development for console debugging
if (import.meta.env.DEV) {
  window.loadQAC = loadQAC;
  window.loadNemlar = loadNemlar;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);