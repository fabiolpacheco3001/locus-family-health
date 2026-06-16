import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";

// M1: Initialize Sentry before first render.
// No-op when VITE_SENTRY_DSN is not set in .env
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
