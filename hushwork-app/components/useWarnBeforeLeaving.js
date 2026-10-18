"use client";

import { useEffect } from "react";

// While `active` is true, closing or reloading the tab makes the browser ask "Leave site?". Used only while step edits
// are not saved. The question's wording is the browser's own and cannot be changed. Clicking a link inside the app does
// not trigger it (those moves happen without a page unload).
export default function useWarnBeforeLeaving(active) {
  useEffect(() => {
    if (!active) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
