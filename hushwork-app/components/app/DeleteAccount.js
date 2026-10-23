"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Btn } from "../ui";
import { deleteMyAccount } from "@/lib/actions/account";

// "Delete my account" in Settings. It asks first and makes the person type the words, because nothing can be brought back afterwards.
// On success the server sends the person to the home page.
export default function DeleteAccount() {
  const [asking, setAsking] = useState(false);
  const [words, setWords] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await deleteMyAccount({ confirm: words });
      } catch (problem) {
        unstable_rethrow(problem); // the redirect after a successful delete is thrown on purpose
        result = { error: "Could not delete. Check your connection and try again." };
      }
      if (result?.error) setError(result.error);
    });
  }

  if (!asking) return <Btn size="sm" variant="secondary" icon="Trash" onClick={() => setAsking(true)}>Delete my account</Btn>;
  return (
    <div className="mt-1 space-y-3">
      <p className="text-sm">This permanently deletes your account, your workflows, runs and schedules, your saved connections, and disconnects the apps you connected through Composio. It cannot be undone.</p>
      <label className="block text-sm" htmlFor="delete-words">Type <strong className="font-medium">delete my account</strong> to confirm</label>
      <input id="delete-words" value={words} onChange={(event) => setWords(event.target.value)} autoComplete="off" spellCheck={false}
        className="h-11 w-full max-w-sm rounded-xl border border-field bg-surface px-3 text-[15px] outline-offset-2" />
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant="dark" loading={pending} disabled={words.trim().toLowerCase() !== "delete my account"} onClick={confirm}>Delete everything</Btn>
        <Btn size="sm" variant="secondary" disabled={pending} onClick={() => { setAsking(false); setWords(""); setError(""); }}>Keep my account</Btn>
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  );
}
