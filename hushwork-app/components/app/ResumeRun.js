"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { resumeRun } from "@/lib/actions/runs";

// "Continue from where it stopped": does the steps of this run that are not done yet. Steps that are done are skipped, so pressing it twice
// can never send an email or create a task twice.
export default function ResumeRun({ runId }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function go() {
    setError("");
    setMessage("");
    startTransition(async () => {
      let result;
      try {
        result = await resumeRun({ runId });
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not continue. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else {
        const { done = 0, skipped = 0, reason = "" } = result.auto ?? {};
        if (reason) setError(reason);
        else setMessage(`Done. ${done} ${done === 1 ? "step" : "steps"} ran now${skipped ? `, ${skipped} already done ${skipped === 1 ? "was" : "were"} skipped` : ""}.`);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <Btn variant="secondary" size="sm" icon="Play" loading={pending} onClick={go}>Continue from where it stopped</Btn>
      <p className="mt-1 text-xs text-mute">Steps that are already done are skipped, so nothing is sent twice.</p>
      {message && <p role="status" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleCheck" className="mt-0.5 shrink-0 text-success" />{message}</p>}
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
