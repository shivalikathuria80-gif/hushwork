"use client";

import { useSyncExternalStore } from "react";

// Does the visitor's system ask for less motion? (Windows: Animation effects off. macOS/iOS: Reduce motion.)
// Why not the ready-made hook from motion? On the first render in the browser it already knows the answer,
// while the server cannot, so the two HTML versions differ and React reports a "hydration mismatch".
// This version answers "no" first (matching the server), then switches to the real answer straight after,
// and keeps following the setting if the visitor changes it while the page is open.
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
