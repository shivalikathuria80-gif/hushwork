"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "../icons";

// MANUAL or AUTO, chosen by the person and remembered in this browser (localStorage key hw-run-mode), like the "Write with AI" switch.
//   Manual (the default): a run only writes down what each step would do. Then the person presses Approve on each real step.
//   Auto: pressing Run does every real step by itself, in order, without asking (see runAutomatically in lib/actions/runs.js).
// useSyncExternalStore keeps every card on the page in step with the one switch. If the browser refuses to store the choice (a private
// window), it lasts until the page closes.
const KEY = "hw-run-mode";
let remembered = "manual";
const listeners = new Set();

function readMode() {
  try { return localStorage.getItem(KEY) === "auto" ? "auto" : "manual"; } catch { return remembered; }
}
function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
function writeMode(mode) {
  remembered = mode;
  try { localStorage.setItem(KEY, mode); } catch { /* private window */ }
  listeners.forEach((listener) => listener());
}

export const useRunMode = () => useSyncExternalStore(subscribe, readMode, () => "manual");

const OPTIONS = [
  { id: "manual", icon: "ShieldCheck", title: "Manual", line: "You approve each step" },
  { id: "auto", icon: "Zap", title: "Auto", line: "Hushwork does every step" },
];

// The switch itself: two big choices and one plain sentence about what the chosen one means.
export function RunModeSwitch() {
  const mode = useRunMode();
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <p id="run-mode-label" className="px-1 text-sm font-medium">How should a run work?</p>
      <div role="radiogroup" aria-labelledby="run-mode-label" className="mt-2 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id} type="button" role="radio" aria-checked={mode === option.id} onClick={() => writeMode(option.id)}
            className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-120 ease-standard ${mode === option.id ? "border-accent bg-accent-subtle" : "border-line hover:bg-raised"}`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${mode === option.id ? "bg-accent text-on-accent" : "bg-raised text-mute"}`}><Icon name={option.icon} size={16} /></span>
            <span className="min-w-0">
              <span className="block font-medium">{option.title}</span>
              <span className="block text-sm text-mute">{option.line}</span>
            </span>
            {mode === option.id && <Icon name="Check" size={16} className="ml-auto shrink-0 text-accent-text" />}
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-sm text-mute">
        {mode === "auto"
          ? "Auto: when you press Run, Hushwork does every step by itself, in order, without asking first. That includes adding a row to your sheet and creating a Linear task. It stops at the first step that does not work."
          : "Manual: a run lists the steps and waits. You press Approve on each step that acts on your apps, and you read the exact words before anything is sent, added or created."}
      </p>
    </div>
  );
}
