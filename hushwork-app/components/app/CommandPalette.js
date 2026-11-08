"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../icons";
import { useMotionPause } from "../MotionProvider";
import PaletteOrb from "./PaletteOrb";
import { pulse } from "./AppScene";
import { buildItems, search } from "@/lib/palette";
import { loadPalette } from "@/lib/actions/palette";
import { startPracticeRun } from "@/lib/actions/runs";

// Ctrl+K (Cmd+K on a Mac) anywhere in the app, or the Search button in the menu: jump to a page, open a run that needs you, start a
// practice run of any workflow, or switch the theme or the animations. Built in the 21st.dev "command menu" style: a glass panel that
// springs in, a highlight that slides between rows, and a three.js orb that spins up as you type. A practice run only looks; anything
// that sends or creates still waits for Approve on the Runs page. Opening it from elsewhere: window.dispatchEvent(new Event("hw:palette")).
export const openPalette = () => { try { window.dispatchEvent(new Event("hw:palette")); } catch {} };

export default function CommandPalette() {
  const router = useRouter();
  const { toggle: toggleMotion } = useMotionPause();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [keys, setKeys] = useState(0); // counts key presses, for the orb
  const input = useRef(null);
  const back = useRef(null); // where the keyboard was before opening
  const id = useId();

  const items = useMemo(() => buildItems(data ?? {}), [data]);
  const shown = useMemo(() => search(items, query), [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => back.current?.focus?.());
  }, []);
  const show = useCallback(() => {
    back.current = document.activeElement;
    setQuery(""); setActive(0); setNote(""); setBusy("");
    setOpen(true);
    loadPalette().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close(); else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hw:palette", show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("hw:palette", show); };
  }, [open, show, close]);

  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);
  useEffect(() => { document.querySelector(`[data-palette-row="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const choose = async (item) => {
    if (!item || busy) return;
    if (item.href) { close(); router.push(item.href); return; }
    if (item.action === "new") { close(); router.push("/app"); setTimeout(() => window.dispatchEvent(new Event("hw:new-workflow")), 250); return; }
    if (item.action === "theme") {
      const next = !document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", next);
      try { localStorage.setItem("hw-theme", next ? "dark" : "light"); } catch {}
      close(); return;
    }
    if (item.action === "motion") { toggleMotion(); close(); return; }
    if (item.action === "run") {
      setBusy(item.id); setNote("");
      try {
        const result = await startPracticeRun({ id: item.workflowId });
        if (result?.ok && result.runId) { pulse("good"); close(); router.push(`/app/runs?run=${encodeURIComponent(result.runId)}`); return; }
        setNote(result?.error || "Could not start the run. Try again.");
        pulse("bad");
      } catch {
        setNote("Could not start the run. Check your connection and try again.");
      }
      setBusy("");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((n) => (shown.length ? (n + 1) % shown.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((n) => (shown.length ? (n - 1 + shown.length) % shown.length : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(shown[active]); }
    else if (e.key === "Tab") e.preventDefault(); // keep the keyboard inside the palette
  };


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette" className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        >
          <button type="button" tabIndex={-1} aria-label="Close" onClick={close} className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[3px] dark:bg-black/50" />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Search Hushwork" onKeyDown={onKeyDown}
            className="hw-glass hw-beam relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
            initial={{ opacity: 0, y: -14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <PaletteOrb energy={keys} empty={query.trim() !== "" && shown.length === 0} className="h-10 w-10 shrink-0" />
              <input
                ref={input} value={query} role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list"
                aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
                onChange={(e) => { setQuery(e.target.value); setActive(0); setKeys((n) => n + 1); setNote(""); }}
                placeholder="Search pages, workflows, or type a command" aria-label="Search"
                className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none! shadow-none! placeholder:text-mute"
              />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-mute sm:block">Esc</kbd>
            </div>
            <ul id={`${id}-list`} role="listbox" aria-label="Results" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              {shown.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-mute">{data ? "Nothing matches. Try another word." : "Loading your workflows…"}</li>
              )}
              {shown.map((item, i) => {
                const heading = item.group !== shown[i - 1]?.group ? item.group : ""; // a heading wherever the group changes
                const on = i === active;
                return (
                  <li key={item.id} role="presentation">
                    {heading && <p aria-hidden="true" className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-mute first:pt-1">{heading}</p>}
                    <div
                      id={`${id}-${i}`} role="option" aria-selected={on} data-palette-row={i}
                      onPointerMove={() => setActive(i)} onClick={() => choose(item)}
                      className="relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
                    >
                      {on && <motion.span layoutId="palette-active" aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl bg-accent-subtle" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-accent text-on-accent" : "bg-raised text-mute"} transition-colors duration-150`}>
                        <Icon name={busy === item.id ? "Loader2" : item.icon} size={16} className={busy === item.id ? "hw-spin" : ""} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-mute">{item.hint}</span>
                      </span>
                      {on && <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-accent-text"><Icon name="ArrowRight" size={16} /></motion.span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-[11px] text-mute">
              <p role="status" className={note ? "text-error" : ""}>{note || "Runs are practice runs: anything that sends waits for your OK."}</p>
              <p className="hidden shrink-0 sm:block"><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
