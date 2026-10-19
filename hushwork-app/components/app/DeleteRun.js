"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { deleteRun } from "@/lib/actions/runs";

// The "Delete this run" button on the Runs page. It asks first, because a deleted run cannot be brought back. After a
// delete the person goes back to the Runs list (the next run, if there is one, is shown).
export default function DeleteRun({ id, name }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await deleteRun({ id });
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not delete. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else router.push("/app/runs");
    });
  }

  if (!asking) return <Btn size="sm" variant="ghost" icon="Trash" onClick={() => setAsking(true)} aria-label={`Delete this run of ${name}`}>Delete this run</Btn>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Delete this run? This cannot be undone.</span>
      <Btn size="sm" variant="dark" loading={pending} onClick={confirm}>Delete run</Btn>
      <Btn size="sm" variant="secondary" disabled={pending} onClick={() => setAsking(false)}>Keep it</Btn>
      {error && <span role="alert" className="w-full text-sm text-error">{error}</span>}
    </div>
  );
}
