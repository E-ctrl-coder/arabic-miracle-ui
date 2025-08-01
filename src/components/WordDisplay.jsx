import React from "react";

function speakSurface(surface) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(surface);
  utter.lang = "ar-SA";
  window.speechSynthesis.speak(utter);
}

export default function WordDisplay({ tokenData, translations }) {
  const { prefix = "", stem = "", suffix = "" } = tokenData;
  const surface = prefix + stem + suffix;
  const t = translations[stem] || translations[prefix] || "";

  return (
    <span
      className="word inline-block"
      title={t}
      onMouseEnter={() => speakSurface(surface)}
    >
      {prefix && <span className="prefix" title={translations[prefix] || ""}>{prefix}</span>}
      {stem &&   <span className="stem"   title={translations[stem]   || ""}>{stem}</span>}
      {suffix && <span className="suffix" title={translations[suffix] || ""}>{suffix}</span>}
      {t && <span className="ml-1 text-sm italic">({t})</span>}
    </span>
  );
}
