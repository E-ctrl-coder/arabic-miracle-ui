// src/api.js

// Point this at your Render backend
const API_BASE = "https://arabic-miracle-api.onrender.com";

/**
 * Send one Arabic word to your Flask API for analysis
 * @param {string} word
 * @returns {Promise<Object>} analysis result
 */
export async function analyzeWord(word) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });

  // If the API returns an error status, throw it so your UI can catch/display it
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `API error: ${res.status}`);
  }

  // Otherwise, return the JSON payload
  return res.json();
}
