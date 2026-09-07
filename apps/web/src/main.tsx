import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Registers the PWA service worker (see public/sw.js) — required for the
// app to be installable / wrappable into an APK via PWABuilder. Scoped to
// BASE_URL so it resolves correctly whether deployed at the domain root or
// under a GitHub Pages subpath.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
