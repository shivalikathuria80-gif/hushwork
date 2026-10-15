"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";

// Two jobs:
// 1. MotionConfig reducedMotion="user": if the visitor's system asks for reduced motion, movement
//    (sliding, scaling) is switched off and only fades and colour changes remain.
// 2. A shared Pause switch for the animations that run on their own (the glow and the workflow band).
//    The choice is saved in the browser (localStorage) so it is remembered on the next visit.
const KEY = "hw-motion";
const listeners = new Set();
let memoryValue = false; // used if the browser refuses to let us save (for example in private mode)

function readPaused() {
  try {
    return localStorage.getItem(KEY) === "paused";
  } catch {
    return memoryValue;
  }
}
function writePaused(next) {
  memoryValue = next;
  try {
    localStorage.setItem(KEY, next ? "paused" : "running");
  } catch {}
  listeners.forEach((listener) => listener());
}
function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => { if (e.key === KEY) listener(); }; // the Pause button used in another tab
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

const PauseContext = createContext({ paused: false, toggle: () => {} });
export const useMotionPause = () => useContext(PauseContext);

export default function MotionProvider({ children }) {
  // false on the server, the saved choice in the browser.
  const paused = useSyncExternalStore(subscribe, readPaused, () => false);

  // Lets CSS pause its own animations: [data-motion="paused"] in globals.css.
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "paused" : "running";
  }, [paused]);

  const toggle = () => writePaused(!readPaused());

  return (
    <PauseContext.Provider value={{ paused, toggle }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </PauseContext.Provider>
  );
}
