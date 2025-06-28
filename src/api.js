// src/api.js
const BASE_URL = "https://arabic-miracle-api.onrender.com";

export async function analyzeWord(word) {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word })
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error || "Failed to analyze");
  }
  return res.json();
}
