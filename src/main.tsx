import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";

// M1: Initialize Sentry before first render.
// No-op when VITE_SENTRY_DSN is not set in .env
initSentry();

// BK-01: Register Service Worker for Web Push (background notifications).
// Works on iOS 16.4+ PWA (home screen) + Android + Desktop.
// The SW scope is '/' — covers the entire app.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    // Non-fatal — app works without SW, push notifications simply won't fire
  });
}

createRoot(document.getElementById("root")!).render(<App />);
