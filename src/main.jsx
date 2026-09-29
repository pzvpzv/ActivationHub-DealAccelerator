import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import "./styles/index.scss";

// A deep link that GitHub Pages could not serve arrives as ?p=/the/path (see scripts/404.html).
const requested = new URLSearchParams(window.location.search);
const path = requested.get("p");
if (path) {
  requested.delete("p");
  const query = requested.toString();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.history.replaceState(null, "", `${base}${path}${query ? `?${query}` : ""}${window.location.hash}`);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
