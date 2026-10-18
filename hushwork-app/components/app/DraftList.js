"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import DraftCard from "./DraftCard";

// The list part of "Your drafts": the three states (could not load, empty, list) plus the "Draft deleted." notice.
export default function DraftList({ drafts, loadFailed, openBase }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");

  // After a delete: say so, and move the keyboard cursor to the next draft (or the one before, or the heading)
  // so it is not left on a button that is about to disappear.
  function onDeleted(id) {
    const at = drafts.findIndex((draft) => draft.id === id);
    const neighbour = drafts[at + 1] ?? drafts[at - 1];
    const target = neighbour ? document.getElementById(`draft-open-${neighbour.id}`) : document.getElementById("drafts-heading");
    target?.focus();
    setNotice("Draft deleted.");
    setTimeout(() => setNotice(""), 5000);
  }

  // The status line is always on the page (even in the error and empty states), so "Draft deleted." is announced
  // after the last draft is deleted too. A live region must exist before its text changes.
  return (
    <>
      <p role="status" className="mt-2 min-h-5 text-sm text-mute">{notice}</p>
      {loadFailed ? (
        <div className="mt-1 rounded-2xl border border-error bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 text-[15px]"><Icon name="CircleAlert" className="shrink-0 text-error" />Could not load your drafts. Check your connection and try again.</p>
          <Btn className="mt-3" size="sm" variant="secondary" icon="RotateCcw" onClick={() => router.refresh()}>Try again</Btn>
        </div>
      ) : drafts.length === 0 && openBase ? (
        <div className="mt-1 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="font-medium">No workflows yet.</p>
          <p className="mt-1 text-[15px] text-mute">Start from a template, build one by hand, or describe a task in the workspace and save its plan.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn href="/app/templates" size="sm" variant="secondary" icon="ListTodo">Browse templates</Btn>
            <Btn href="/app/builder" size="sm" icon="Plus">Open the Builder</Btn>
          </div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="mt-1 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="font-medium">No drafts yet.</p>
          <p className="mt-1 text-[15px] text-mute">Preview a plan above, then choose Save as draft.</p>
          <Btn className="mt-3" size="sm" variant="ghost" icon="Pencil" onClick={() => document.getElementById("task")?.focus()}>Write a request</Btn>
        </div>
      ) : (
        <ul className="mt-1">
          <AnimatePresence initial={false}>
            {drafts.map((draft) => (
              <motion.li
                key={draft.id} className="overflow-hidden pb-3"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, paddingBottom: 0 }} transition={{ duration: 0.2 }}
              >
                <DraftCard draft={draft} onDeleted={onDeleted} openBase={openBase} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  );
}
