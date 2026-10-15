"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./icons";
import { EASE } from "./ui";

const FOLDERS = [
  ["Sales", [["Score new leads", "Hourly"], ["Top-5 digest", "Mondays"], ["Follow-up nudges", "Daily"]]],
  ["Support", [["Triage inbox", "Live"], ["Draft replies", "On email"], ["Weekly themes", "Fridays"]]],
  ["Finance", [["Chase invoices", "Weekly"], ["File receipts", "On email"], ["Monthly summary", "1st"]]],
];

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } }, exit: { opacity: 0, transition: { duration: 0.12 } } };
const rowVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } } };

// Folder tabs: a real tablist, so each folder is a button and the arrow keys move between them.
// The accent line slides from tab to tab, which shows that it is the same panel with different contents.
export default function Automations() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef([]);

  const onKeyDown = (e) => {
    const last = FOLDERS.length - 1;
    let next = selected;
    if (e.key === "ArrowRight") next = selected === last ? 0 : selected + 1;
    else if (e.key === "ArrowLeft") next = selected === 0 ? last : selected - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setSelected(next);
    tabs.current[next] && tabs.current[next].focus();
  };
  const [, files] = FOLDERS[selected];

  return (
    <section id="auto" className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">What it automates</h2>
      <p className="mt-3 max-w-xl text-[17px] text-mute">Pick a folder to see the workflows inside.</p>
      <div className="mt-10">
        <div role="tablist" aria-label="Workflow folders" onKeyDown={onKeyDown} className="flex gap-1">
          {FOLDERS.map(([name, items], i) => (
            <button
              key={name} ref={(el) => (tabs.current[i] = el)} role="tab" id={`folder-tab-${i}`}
              aria-selected={selected === i} aria-controls="folder-panel" tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)}
              className={`relative -mb-px inline-flex h-11 items-center gap-2 rounded-t-xl border px-4 text-sm font-medium transition-colors ${selected === i ? "border-line border-b-surface bg-surface text-ink" : "border-transparent bg-raised/70 text-mute hover:text-ink"}`}
            >
              {selected === i && <motion.span layoutId="folder-indicator" className="absolute inset-x-3 -top-px h-0.5 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <Icon name={selected === i ? "FolderOpen" : "Folder"} size={16} />{name}<span className="font-normal text-mute">{items.length}</span>
            </button>
          ))}
        </div>
        <div role="tabpanel" id="folder-panel" aria-labelledby={`folder-tab-${selected}`} tabIndex={0} className="rounded-b-2xl rounded-tr-2xl border border-line bg-surface p-3 sm:p-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul key={selected} className="space-y-2" variants={listVariants} initial="hidden" animate="show" exit="exit">
              {files.map(([name, when]) => (
                <motion.li key={name} variants={rowVariants} className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3.5">
                  <Icon name="FileText" className="shrink-0 text-mute" /><span className="font-medium">{name}</span><span className="ml-auto text-sm text-mute">{when}</span>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
