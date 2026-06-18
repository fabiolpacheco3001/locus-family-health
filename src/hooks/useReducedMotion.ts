import { useState, useEffect } from "react";

/**
 * Returns true if the user has requested reduced motion via OS/browser settings.
 * Listens for real-time changes so the component reacts without a page reload.
 *
 * Usage:
 *   const prefersReducedMotion = useReducedMotion();
 *   // Disable animations / autoplay when true
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}
