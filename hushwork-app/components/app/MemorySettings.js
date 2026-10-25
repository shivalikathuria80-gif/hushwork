"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { addMemory, deleteMemory } from "@/lib/actions/memory";

// Settings > Memory: short facts the AI may use as background. The list comes from the server; adding and deleting go through Server Actions.
const field = "h-11 w-full rounded-xl border border-field bg-surface px-3 text-[15px] outline-offset-2";

export default function MemorySettings({ facts }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pending, startTransition] = useTransition();

  async function call(run) {
    try {
      return await run();
    } catch (problem) {
      unstable_rethrow(problem);
      return { error: "Could not reach Hushwork. Check your connection and try again." };
    }
  }

  function add(event) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await call(() => addMemory({ key, value }));
      if (result.error) return setError(result.error);
      setKey("");
      setValue("");
      router.refresh();
    });
  }

  function remove(id) {
    setError("");
    setBusyId(id);
    startTransition(async () => {
      const result = await call(() => deleteMemory({ id }));
      setBusyId("");
      if (result.error) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      {facts.length === 0 ? (
        <p className="text-sm text-mute">Nothing saved yet. Add a fact below, for example &ldquo;Timezone: India (IST)&rdquo;.</p>
      ) : (
        <ul className="space-y-2">
          {facts.map((fact) => (
            <li key={fact.id} className="flex items-start gap-3 rounded-xl border border-line bg-raised px-3 py-2">
              <p className="min-w-0 flex-1 break-words text-[15px]"><b className="font-medium">{fact.key}:</b> {fact.value}</p>
              <Btn size="sm" variant="ghost" icon="Trash" loading={busyId === fact.id} disabled={pending} onClick={() => remove(fact.id)} aria-label={`Forget ${fact.key}`}>Forget</Btn>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="memory-key" className="text-sm font-medium">Name</label>
          <input id="memory-key" value={key} onChange={(event) => setKey(event.target.value)} maxLength={60} placeholder="Timezone" autoComplete="off" className={`${field} mt-1`} />
        </div>
        <div>
          <label htmlFor="memory-value" className="text-sm font-medium">Fact</label>
          <input id="memory-value" value={value} onChange={(event) => setValue(event.target.value)} maxLength={300} placeholder="India (IST)" autoComplete="off" className={`${field} mt-1`} />
        </div>
        <Btn type="submit" size="sm" icon="Plus" loading={pending && !busyId} disabled={!key.trim() || !value.trim()}>Remember</Btn>
      </form>
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
