"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { useFillComposer } from "./Workspace";
import { renameDraft, deleteDraft } from "@/lib/actions/drafts";
import { LIMITS } from "@/lib/validate";

// One saved draft: a name you can open, rename or delete. A draft is only a saved preview plan and never runs.
// Opening it puts its request and steps back into the composer; it does not start anything.

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

// The saved time is worked out in the browser only, so it is always shown in the visitor's own time zone.
// (If the server formatted it, a hosted server's time zone would be shown instead.) useSyncExternalStore gives the
// server an empty answer and the browser the real one, without any setState-in-an-effect.
const subscribeToNothing = () => () => {};
function useSavedTime(updatedAt) {
  return useSyncExternalStore(
    subscribeToNothing,
    () => { const date = new Date(updatedAt); return Number.isNaN(date.getTime()) ? "" : when.format(date); },
    () => "",
  );
}
const iconButton = "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-mute transition-colors hover:bg-raised hover:text-ink";

// Calls a Server Action. A failed request (offline, server down) becomes a plain sentence instead of a crash.
// A redirect (signed out) is let through: Next.js delivers it as an error that must not be swallowed.
async function call(action, input, fallback) {
  try {
    return await action(input);
  } catch (problem) {
    unstable_rethrow(problem);
    return { error: fallback };
  }
}

export default function DraftCard({ draft, onDeleted }) {
  const fill = useFillComposer();
  const [mode, setMode] = useState("view"); // view | rename | delete
  const [name, setName] = useState(draft.name);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef(null);
  const renameRef = useRef(null);
  const deleteRef = useRef(null);
  const keepRef = useRef(null);
  const focusAfter = useRef(null); // which button gets the cursor back when we return to "view"

  // Keyboard focus follows the mode: into the input or the safe button, and back to where the person was.
  useEffect(() => {
    if (mode === "rename") { inputRef.current?.focus(); inputRef.current?.select(); }
    else if (mode === "delete") keepRef.current?.focus();
    else if (focusAfter.current) {
      (focusAfter.current === "rename" ? renameRef : deleteRef).current?.focus();
      focusAfter.current = null;
    }
  }, [mode]);

  const back = (returnTo) => { focusAfter.current = returnTo; setError(""); setMode("view"); };
  const startRename = () => { setName(draft.name); setError(""); setMode("rename"); };

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the draft a name.");
    if (trimmed.length > LIMITS.nameMax) return setError(`Use ${LIMITS.nameMax} characters or fewer.`);
    startTransition(async () => {
      const result = await call(renameDraft, { id: draft.id, name: trimmed }, "Could not rename. Try again.");
      if (result.error) setError(result.error);
      else back("rename");
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await call(deleteDraft, { id: draft.id }, "Could not delete. Try again.");
      if (result.error) setError(result.error);
      else onDeleted(draft.id);
    });
  }

  const steps = `${draft.plan.length} ${draft.plan.length === 1 ? "step" : "steps"}`;
  const savedText = useSavedTime(draft.updatedAt);

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-3"
      onKeyDown={(event) => { if (event.key === "Escape" && mode !== "view") back(mode === "rename" ? "rename" : "delete"); }}
    >
      {mode === "delete" ? (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 px-1 text-[15px]">Delete this draft? This cannot be undone.</p>
            <Btn variant="dark" size="sm" loading={pending} onClick={confirmDelete}>Delete draft</Btn>
            <Btn variant="secondary" size="sm" ref={keepRef} disabled={pending} onClick={() => back("delete")}>Keep draft</Btn>
          </div>
          {error && <p role="alert" className="mt-2 px-1 text-sm">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-accent-text"><Icon name="Workflow" size={18} /></span>
          {mode === "rename" ? (
            <div className="min-w-0 flex-1">
              <input
                ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} aria-label="Draft name"
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveName(); } }}
                aria-invalid={error ? true : undefined} aria-describedby={error ? `rename-error-${draft.id}` : undefined}
                className={`h-11 w-full rounded-xl border bg-surface px-3 text-[15px] ${error ? "border-ink" : "border-field"}`}
              />
              {error && <p id={`rename-error-${draft.id}`} role="alert" className="mt-1 text-sm">{error}</p>}
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <button
                id={`draft-open-${draft.id}`} type="button" onClick={() => fill(draft.prompt, draft.plan)} aria-label={`Open draft: ${draft.name}`}
                className="relative -my-2.5 block min-h-11 max-w-full truncate rounded text-left font-medium hover:underline md:my-0 md:min-h-6"
              >
                {draft.name}
              </button>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
                <span>{savedText && <>Saved <time dateTime={draft.updatedAt}>{savedText}</time> · </>}{steps}</span>
                <span className="rounded-md border border-line bg-raised px-1.5 text-xs uppercase tracking-wide">Draft</span>
              </p>
            </div>
          )}
          {mode === "rename" ? (
            <>
              <button type="button" aria-label="Save name" disabled={pending} onClick={saveName} className={iconButton}>
                <Icon name={pending ? "Loader2" : "Check"} size={18} className={pending ? "hw-spin" : ""} />
              </button>
              <button type="button" aria-label="Cancel" disabled={pending} onClick={() => back("rename")} className={iconButton}><Icon name="X" size={18} /></button>
            </>
          ) : (
            <>
              <button type="button" ref={renameRef} aria-label={`Rename draft: ${draft.name}`} onClick={startRename} className={iconButton}><Icon name="Pencil" size={18} /></button>
              <button type="button" ref={deleteRef} aria-label={`Delete draft: ${draft.name}`} onClick={() => { setError(""); setMode("delete"); }} className={iconButton}><Icon name="Trash" size={18} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
