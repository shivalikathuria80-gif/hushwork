"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { createApiToken, deleteApiToken } from "@/lib/actions/tokens";

// Settings > Chatbot plugin: the person's API tokens for the Hushwork plugin (Claude or another chatbot using /api/mcp).
// A new token is shown once, here, right after it is made; the list only ever shows names and the first characters.
const field = "h-11 w-full rounded-xl border border-field bg-surface px-3 text-[15px] outline-offset-2";
const day = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

export default function PluginTokens({ tokens, endpoint }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");
  const [copied, setCopied] = useState(false);
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

  function make(event) {
    event.preventDefault();
    setError("");
    setCopied(false);
    startTransition(async () => {
      const result = await call(() => createApiToken({ name }));
      if (result.error) return setError(result.error);
      setFresh(result.token);
      setName("");
      router.refresh();
    });
  }

  function remove(id) {
    setError("");
    setBusyId(id);
    startTransition(async () => {
      const result = await call(() => deleteApiToken({ id }));
      setBusyId("");
      if (result.error) return setError(result.error);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-mute">Plugin address: <code className="break-all rounded bg-raised px-1.5 py-0.5 text-[13px] text-ink">{endpoint}</code></p>
      {fresh && (
        <div role="status" className="mt-3 rounded-xl border border-accent bg-accent-subtle p-3">
          <p className="text-sm font-medium">Your new token. Copy it now: Hushwork keeps only a fingerprint of it and cannot show it again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-2 py-1.5 text-[13px]">{fresh}</code>
            <Btn size="sm" variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</Btn>
          </div>
        </div>
      )}
      {tokens.length === 0 ? (
        <p className="mt-3 text-sm text-mute">No tokens yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-start gap-3 rounded-xl border border-line bg-raised px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="break-words text-[15px] font-medium">{token.name}</p>
                <p className="text-sm text-mute"><code>{token.prefix}…</code> · made {day(token.createdAt)} · last used {day(token.lastUsedAt)}</p>
              </div>
              <Btn size="sm" variant="ghost" icon="Trash" loading={busyId === token.id} disabled={pending} onClick={() => remove(token.id)} aria-label={`Remove ${token.name}`}>Remove</Btn>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={make} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="token-name" className="text-sm font-medium">Name</label>
          <input id="token-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Claude on my laptop" autoComplete="off" className={`${field} mt-1`} />
        </div>
        <Btn type="submit" size="sm" icon="Plus" loading={pending && !busyId} disabled={!name.trim()}>Make a token</Btn>
      </form>
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
