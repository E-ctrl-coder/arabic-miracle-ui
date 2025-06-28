// src/App.jsx
import React from "react";
import Analyzer from "./Analyzer";

export default function App() {
  return (
    <div className="max-w-xl mx-auto p-6">
      {/* Page title */}
      <h1 className="text-3xl font-bold mb-6">
        Arabic Miracle Analyzer
      </h1>

      {/* Main content wrapper with vertical spacing */}
      <div className="space-y-4">
        <Analyzer />
      </div>
    </div>
  );
}
