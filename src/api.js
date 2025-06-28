// src/api.js
const BASE_URL = "https://arabic-miracle-api.onrender.com";
console.log("🔗 API base URL:", BASE_URL);

export async function analyzeWord(word) {
  // build full URL
  const url = new URL("/analyze", BASE_URL).href;
  console.log("🚀 Fetching:", url, "with word:", word);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });

  // if we got HTML back, dump first 200 chars
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const text = await res.text();
    console.error("⚠️ Received HTML instead of JSON:", text.slice(0, 200));
    throw new Error("Server returned HTML, not JSON. See console for snippet.");
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    console.error("❌ API error payload:", payload);
    throw new Error(payload.error || "Failed to analyze");
  }

  return res.json();
}
