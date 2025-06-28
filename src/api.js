// src/api.js
const BASE_URL = "https://arabic-miracle-api.onrender.com";
console.log("🔗 API base URL is:", BASE_URL);

export async function analyzeWord(word) {
  const url = `${BASE_URL}/analyze`;
  console.log("🚀 Fetching URL:", url, "with payload:", { word });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const body = await res.text();
    console.error(
      "⚠️ Got HTML instead of JSON! First 200 chars:\n",
      body.slice(0, 200)
    );
    throw new Error("Server returned HTML, not JSON. See console.");
  }

  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch {}
    console.error("❌ API responded with error payload:", payload);
    throw new Error(payload.error || "Unknown API error");
  }

  const data = await res.json();
  console.log("✅ API returned JSON:", data);
  return data;
}
