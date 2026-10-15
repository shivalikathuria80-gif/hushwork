"use client";

import { useCallback, useSyncExternalStore } from "react";

// Does a CSS media query match right now, e.g. useMediaQuery("(min-width: 1024px)")?
// Same idea as usePrefersReducedMotion: it answers "no" on the server and first render (so the HTML matches),
// then switches to the real answer and follows changes.
export function useMediaQuery(query) {
  const subscribe = useCallback((callback) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", callback);
    return () => media.removeEventListener("change", callback);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
