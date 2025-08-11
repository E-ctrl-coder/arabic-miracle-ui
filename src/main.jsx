import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css"; // ✅ match actual filename

console.log("main.jsx starting...");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
