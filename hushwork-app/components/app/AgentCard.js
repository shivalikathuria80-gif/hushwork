"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { useFillComposer } from "./Workspace";
import { dismissNote, lookNow, turnAgentOff, turnAgentOn } from "@/lib/actions/agent";
import { niceTime } from "@/lib/connectors/time-format";

// The Hushwork Agent at the top of the workspace (see lib/agent/brain.js). Off: one card that says what it does and a button to turn it on.
// On: what it noticed, each note with "Do this" (puts the note's request in the box below, where the person gets a plan and approves every
// writing step as usual) and "Dismiss". `state` comes from AgentPanel.js: { enabled, checkedAt, nextCheckAt, tzOffset, status, notes } or null.
const STATUS_TEXT = {
  quiet: "Nothing needs you right now. It looks again at the next time below.",
  nothing_connected: "There is nothing to look at yet. Connect Google, Linear or another app first.",
  failed: "The last look did not work. The notes below are from the look before. Press Look now to try again.",
};

export default function AgentCard({ state }) {
  const router = useRouter();
  const fill = useFillComposer();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const on = state?.enabled === true;
  const notes = (state?.notes ?? []).filter((note) => !note.dismissed);
  const tzOffset = () => -new Date().getTimezoneOffset(); // minutes east of UTC, the same number schedules use
  const when = (iso) => (iso ? niceTime(Date.parse(iso), { offset: state.tzOffset, suffix: "" }) : "");

  function act(action, input) {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await action(input);
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not reach Hushwork. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else if (result.note) setError(result.note);
      router.refresh();
    });
  }

  function doThis(note) {
    fill(note.ask);
    document.getElementById("task")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section aria-labelledby="agent-heading" aria-busy={pending} className="mb-8 rounded-2xl border border-line-strong bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="agent-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name="Sparkles" size={18} /></span>
            Your Hushwork Agent
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${on ? "bg-accent-subtle text-accent-text" : "bg-raised text-mute"}`}>{on ? "On" : "Off"}</span>
          </h2>
          {on && (
            <p className="mt-1 text-sm text-mute">
              {state.checkedAt ? <>Last look: {when(state.checkedAt)}. </> : "First look on its way. "}
              {state.nextCheckAt && <>Next look: {when(state.nextCheckAt)}.</>}
            </p>
          )}
        </div>
        {on && (
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" variant="secondary" icon="RotateCcw" loading={pending} onClick={() => act(lookNow, { tzOffset: tzOffset() })}>Look now</Btn>
            <Btn size="sm" variant="ghost" icon="Pause" disabled={pending} onClick={() => act(turnAgentOff)}>Turn off</Btn>
          </div>
        )}
      </div>

      {!on && (
        <div className="mt-3 text-sm">
          <p className="max-w-[62ch]">Turn it on once and it keeps working for you. Three times a day (9:00, 13:00 and 17:00 your time) it looks at the apps you connected: your calendar, who emailed you and about what, your Linear tasks, and apps like Stripe or GitHub. Then it tells you the few things that need you, each with a ready next step.</p>
          <ul className="mt-2 space-y-1 text-mute">
            <li className="flex gap-2"><Icon name="ShieldCheck" className="mt-0.5 shrink-0" />It only reads. It never sends, creates or changes anything by itself.</li>
            <li className="flex gap-2"><Icon name="Mail" className="mt-0.5 shrink-0" />It emails you only when it finds something new: at most 3 times a day, never at night.</li>
            <li className="flex gap-2"><Icon name="Info" className="mt-0.5 shrink-0" />Each look uses one of your 15 AI steps a day. Email senders and subjects go to the AI (Groq), never the text of an email.</li>
          </ul>
          <Btn className="mt-4" icon="Sparkles" loading={pending} onClick={() => act(turnAgentOn, { tzOffset: tzOffset() })}>Turn on the agent</Btn>
        </div>
      )}

      {on && (
        <div className="mt-4">
          {notes.length > 0 ? (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.title} className="rounded-xl border border-line bg-raised p-3">
                  <p className="font-medium">{note.title}</p>
                  {note.why && <p className="mt-1 text-sm text-mute">{note.why}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.ask && <Btn size="sm" icon="ArrowRight" onClick={() => doThis(note)}>Do this</Btn>}
                    <Btn size="sm" variant="ghost" icon="X" disabled={pending} onClick={() => act(dismissNote, { title: note.title })}>Dismiss</Btn>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">
              {STATUS_TEXT[state.status] ?? (state.checkedAt ? "Nothing needs you right now." : "Press Look now to see what it finds.")}
              {state.status === "nothing_connected" && <> <Link href="/app/connections" className="font-medium text-accent-text hover:underline">Open Connections</Link></>}
            </p>
          )}
          {notes.length > 0 && <p className="mt-3 text-xs text-mute">&ldquo;Do this&rdquo; puts the request in the box below. You get a plan, and every step that sends or creates something still waits for your Approve.</p>}
        </div>
      )}

      {error && <p role="alert" className="mt-3 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </section>
  );
}
