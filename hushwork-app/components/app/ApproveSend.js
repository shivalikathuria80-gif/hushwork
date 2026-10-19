"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { approveTelegramSend } from "@/lib/actions/runs";

// The one place a workflow really does something. It shows the exact message, says where it goes, and sends only when
// you press the button. `message` is for reading; the server builds the real text again from the saved run.
export default function ApproveSend({ runId, index, message, connected }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await approveTelegramSend({ runId, index });
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not send. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else if (result.runId) router.push(`/app/runs?run=${result.runId}`);
      else setError(result.note ?? "Sent.");
    });
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 font-semibold"><Icon name="ShieldCheck" size={18} className="text-accent-text" />Needs your approval</p>
      <p className="mt-1 text-sm text-mute">This step is set to Telegram. If you approve, this message is sent to your own Telegram chat. Nobody else receives it.</p>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-line bg-raised p-3 font-sans text-sm">{message}</pre>
      {connected ? (
        <Btn className="mt-3" icon="Send" loading={pending} onClick={send}>Approve and send to my Telegram</Btn>
      ) : (
        <p className="mt-3 text-sm text-mute">Telegram is not connected yet, so nothing can be sent. <Link href="/app/connections">See how to connect it</Link>.</p>
      )}
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
