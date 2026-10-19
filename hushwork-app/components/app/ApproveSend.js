"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { approveWebCall } from "@/lib/actions/runs";

// The one place a workflow really does something. It shows exactly what will happen and does it only when you press the
// button. `message` is for reading; the server builds the real thing again from the saved run.
export default function ApproveSend({ runId, index, message }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await approveWebCall({ runId, index });
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not send. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else if (result.runId) router.push(`/app/runs?run=${result.runId}`);
      else setError(result.note ?? "Done.");
    });
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 font-semibold"><Icon name="ShieldCheck" size={18} className="text-accent-text" />Needs your approval</p>
      <p className="mt-1 text-sm text-mute">This step calls a web address. If you approve, Hushwork asks it once and saves the start of the answer. Hushwork refuses private or internal addresses and does not follow redirects.</p>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-line bg-raised p-3 font-sans text-sm">{message}</pre>
      <Btn className="mt-3" icon="Plug" loading={pending} onClick={send}>Approve and call the address</Btn>
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
