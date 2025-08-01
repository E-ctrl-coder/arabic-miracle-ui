// src/components/WordDisplay.jsx
import React from "react";

// Speak Arabic text
function speak(text) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ar-SA";
  window.speechSynthesis.speak(utter);
}

export default function WordDisplay({ tokenData, translations }) {
  const { prefix, stem, suffix, root } = tokenData;
  // Combined surface word
  const fullWord = `${prefix || ""}${stem || ""}${suffix || ""}${root || ""}`;
  // Prefer stem translation, then root
  const t = translations[stem] || translations[root] || "";

  return (
    <span
      className="word inline-block"
      title={t}                      // hover anywhere for translation
      onMouseEnter={() => speak(fullWord)}
    >
      {prefix && (
        <span
          className="prefix text-teal-600"
          title={translations[prefix] || ""}
        >
          {prefix}
        </span>
      )}
      {stem && (
        <span
          className="stem text-purple-600"
          title={translations[stem] || ""}
        >
          {stem}
        </span>
      )}
      {suffix && (
        <span
          className="suffix text-orange-600"
          title={translations[suffix] || ""}
        >
          {suffix}
        </span>
      )}
      {root && (
        <span
          className="root bg-yellow-200 px-1 rounded"
          title={translations[root] || ""}
        >
          {root}
        </span>
      )}
      {t && <span className="ml-1 text-sm italic">({t})</span>}
    </span>
  );
}
