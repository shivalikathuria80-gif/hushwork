"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { createAgent } from "@/lib/actions/agents";
import { LIMITS } from "@/lib/validate";

// The box at the top of the Agents page: describe a task in plain English, press Create agent. The server plans it, saves it as an agent,
// schedules it if the sentence says when, and runs it once (lib/agents/create.js). The person then lands on that run on the Runs page, where
// any step that writes waits for their Approve. If the run could not start, the agent is still saved and the box says so.

// Sentences a new person can tap. Each one is a task Hushwork can really do, and says which connections it needs.
const EXAMPLES = [
  { text: "Every weekday at 9, sum up today's meetings and email them to me", needs: "Google and Gmail (send)" },
  { text: "Every Friday at 4pm, list my unpaid Stripe invoices and email me the list", needs: "Stripe and Gmail (send)" },
  { text: "Look at my open Linear tasks and tell me which one to do first", needs: "Linear" },
];
const FAILED = "Could not create your agent. Check your connection and try again.";

export default function AgentMaker() {
  const router = useRouter();
  const boxRef = useRef(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { name, lines: [...] } when the agent was saved but its run could not open
  const [pending, startTransition] = useTransition();

  function create() {
    const task = text.trim();
    if (!task) { setError("Describe what your agent should do first."); boxRef.current?.focus(); return; }
    if (task.length > LIMITS.promptMax) { setError(`Use ${LIMITS.promptMax} characters or fewer.`); return; }
    setError("");
    setDone(null);
    startTransition(async () => {
      let result;
      try {
        result = await createAgent({ prompt: task, tzOffset: -new Date().getTimezoneOffset() });
      } catch (problem) {
        unstable_rethrow(problem); // signed out: the server redirects to /login
        setError(FAILED);
        return;
      }
      if (result?.error) { setError(result.error); return; }
      setText("");
      // The Runs page gets only a fixed word (new or scheduled), never text: it picks its own sentence, so an address cannot make it say anything.
      if (result.runId) {
        const stopped = result.auto?.stoppedAt ? "stopped" : "done";
        router.push(`/app/runs?run=${result.runId}&auto=${stopped}&agent=${result.scheduleText.startsWith("Scheduled") ? "scheduled" : "new"}`);
        return;
      }
      setDone({ name: result.name, lines: [result.runError ? `It could not run yet: ${result.runError}` : "", result.scheduleText, result.notice ?? ""].filter(Boolean) });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="field-focus rounded-3xl border border-field bg-surface p-4 shadow-sm">
        <label htmlFor="agent-task" className="sr-only">Describe what your agent should do</label>
        <textarea
          id="agent-task" ref={boxRef} rows={3} value={text} readOnly={pending} maxLength={LIMITS.promptMax}
          onChange={(event) => { setText(event.target.value); if (error) setError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); create(); } }}
          aria-describedby="agent-note" aria-invalid={error ? true : undefined}
          placeholder="e.g. Every Monday at 9, sum up my week in Linear and email it to me"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-hidden placeholder:text-hint"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p id="agent-note" className="text-sm text-mute">Say when, like “every weekday at 9”, and it runs on that schedule too.</p>
          <Btn icon={pending ? undefined : "Bot"} loading={pending} onClick={create}>{pending ? "Making your agent" : "Create agent"}</Btn>
        </div>
      </div>
      <p role="status" className="sr-only">{pending ? "Hushwork is making your agent and running it. This can take a little while." : ""}</p>
      {pending && <p className="mt-2 px-1 text-sm text-mute">Planning the steps, saving the agent and running it once. This can take up to a minute.</p>}
      {error && <p role="alert" className="mt-2 flex items-start gap-2 px-1 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
      {done && (
        <div role="status" className="mt-3 rounded-2xl border border-line bg-surface p-3 text-sm shadow-sm">
          <p className="flex items-start gap-2 font-medium"><Icon name="CircleCheck" className="mt-0.5 shrink-0 text-accent-text" />Saved your agent “{done.name}”.</p>
          {done.lines.map((line) => <p key={line} className="mt-1 text-mute">{line}</p>)}
        </div>
      )}

      <section aria-labelledby="agent-examples-heading" className="mt-4">
        <h2 id="agent-examples-heading" className="text-sm font-medium text-mute">Not sure what to type? Tap one, then press Create agent.</h2>
        <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {EXAMPLES.map((example) => (
            <li key={example.text}>
              <button
                type="button" disabled={pending} onClick={() => { setText(example.text); setError(""); boxRef.current?.focus(); }}
                className="flex min-h-11 w-full flex-col items-start rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm transition-[background-color,border-color] duration-120 ease-standard hover:border-line-strong active:bg-raised sm:w-auto sm:max-w-[28ch] md:min-h-9"
              >
                <span>{example.text}</span>
                <span className="font-mono text-xs text-mute">Needs {example.needs}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
