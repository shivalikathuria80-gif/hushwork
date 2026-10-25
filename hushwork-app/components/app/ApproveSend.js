"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import Link from "next/link";
import { approveWebCall, approveLinearLookup, approveCalendarLookup, approveGmailLookup, approveDriveLookup, approveLinearCreate, approveAppLookup, approveActionStep, approveSheetsRow, approveAiStep } from "@/lib/actions/runs";

// The one place a workflow really does something. It shows exactly what will happen and does it only when you press the
// button. `message` is for reading; the server builds the real thing again from the saved run.
const COPY = {
  request: {
    action: approveWebCall,
    intro: "This step calls a web address. If you approve, Hushwork asks it once and saves the start of the answer. Hushwork refuses private or internal addresses and does not follow redirects.",
    button: "Approve and call the address",
    icon: "Plug",
  },
  ai: {
    action: approveAiStep,
    intro: "This step asks the AI. If you approve, your request (and anything the AI reads) goes to Groq, the company that runs the AI, and Hushwork saves its answer. The AI can only read. It cannot change anything.",
    button: "Approve and ask the AI",
    icon: "Sparkles",
  },
  sheets: {
    action: approveSheetsRow,
    intro: "This step adds a row to your Google Sheet. If you approve, Hushwork adds ONE row at the bottom with exactly the boxes below. It adds a row and changes nothing else.",
    button: "Approve and add the row",
    icon: "Table",
  },
  calendar: {
    action: approveCalendarLookup,
    intro: "This step looks in your Google Calendar. If you approve, Hushwork asks Google for your next events and saves the list. It can only read: nothing in your calendar is changed.",
    button: "Approve and ask Google Calendar",
    icon: "Calendar",
  },
  gmail: {
    action: approveGmailLookup,
    intro: "This step looks in your Gmail inbox. If you approve, Hushwork asks Google for the latest messages and saves who sent each one, its subject and its time. It never reads the text inside an email, and it cannot send, change or delete anything.",
    button: "Approve and ask Gmail",
    icon: "Mail",
  },
  drive: {
    action: approveDriveLookup,
    intro: "This step looks at your Google Drive. If you approve, Hushwork asks Google for the files you changed most recently and saves each file's name, kind and time. It never opens a file or reads what is inside, and it cannot change or delete anything.",
    button: "Approve and ask Google Drive",
    icon: "FolderOpen",
  },
  action: {
    action: approveActionStep,
    intro: "This step does something in another app you connected through Composio (sends a Slack message, creates a GitHub issue or adds a Todoist task). If you approve, Hushwork does exactly the one thing written below and nothing else. It can be approved only once per run.",
    button: "Approve and send it",
    icon: "Send",
  },
  app: {
    action: approveAppLookup,
    intro: "This step looks in another app you connected through Composio. If you approve, Hushwork asks Composio to read one fixed thing from the app and saves the answer. It can only read: nothing in the app is changed. What is read passes through Composio.",
    button: "Approve and look in the app",
    icon: "Plug",
  },
  issue: {
    action: approveLinearCreate,
    intro: "This step adds a new task in Linear. If you approve, Hushwork creates ONE task with exactly the words below. It cannot change or delete anything that already exists, and it can be approved only once per run.",
    button: "Approve and create the task",
    icon: "ListTodo",
  },
  linear: {
    action: approveLinearLookup,
    intro: "This step looks in Linear. If you approve, Hushwork asks Linear for your open tasks and saves the list. It can only read: nothing in Linear is changed.",
    button: "Approve and ask Linear",
    icon: "Search",
  },
};

export default function ApproveSend({ runId, index, message, kind = "request", connected = true, unknown = false }) {
  const copy = COPY[kind];
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await copy.action({ runId, index, ...(unknown ? { confirmRetry: true } : {}) }); // "it was not done" is the person's word that a step Hushwork lost track of may be sent again
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not send. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else router.refresh(); // the result now shows right under the step on this same page
      if (!result.error && result.note) setError(result.note);
    });
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 font-semibold"><Icon name="ShieldCheck" size={18} className="text-accent-text" />Needs your approval</p>
      <p className="mt-1 text-sm text-mute">{copy.intro}</p>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-line bg-raised p-3 font-sans text-sm">{message}</pre>
      {unknown && <p className="mt-3 rounded-xl bg-raised px-3 py-2 text-sm"><b className="font-medium">Check first.</b> This step was started, but Hushwork never saw whether it finished. It may already have been done, so it is not sent again by itself. Look in the app. Only if it was NOT done, press the button.</p>}
      {connected ? (
        <Btn className="mt-3" icon={copy.icon} loading={pending} onClick={send}>{unknown ? "It was not done, try again" : copy.button}</Btn>
      ) : (
        <p className="mt-3 text-sm text-mute">{kind === "ai" ? "AI is switched off (no Groq key), so nothing can be asked." : <>{kind === "calendar" || kind === "sheets" || kind === "gmail" || kind === "drive" ? "Google" : "Linear"} is not connected yet, so nothing can be asked. <Link href="/app/connections">See how to connect it</Link>.</>}</p>
      )}
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
