"use client";

import { useSyncExternalStore } from "react";

// Light/dark is stored as a "dark" class on <html> (set before the page paints by the script in layout.js).
// This hook reads that class and re-renders whenever it changes.
// It returns null on the server and during hydration, so the server and browser HTML stay identical.
function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => null;

export function useTheme() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("hw-theme", next ? "dark" : "light");
    } catch {}
  };
  return [dark, toggle];
}
