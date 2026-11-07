"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn } from "./ui";
import { Icon } from "./icons";
import { PLUGIN_ADDRESS } from "@/lib/plugin/address";

// The chatbot plugin, told in one box: what it does, the address to paste, and three steps. The landing page shows it to visitors
// (with a sign-up button) and the app's home page shows it to signed-in people (with how many chatbots are connected and a link to
// Settings, where connections and API tokens are managed). The address is the same for everyone: /api/mcp on this site.

const STEPS = [
  "In Claude, open Settings, then Connectors, then Add custom connector.",
  "Name it Hushwork, paste the address above and press Add.",
  "Press Connect, sign in to Hushwork and press Allow.",
];

export function CopyAddress({ value = PLUGIN_ADDRESS }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface p-1.5 pl-3">
      <code className="min-w-0 flex-1 break-all text-[13px]">{value}</code>
      <Btn size="sm" variant="secondary" icon={copied ? "Check" : undefined} onClick={copy} aria-label="Copy the plugin address">{copied ? "Copied" : "Copy"}</Btn>
    </div>
  );
}

// `connected`: how many chatbots this person has connected (app only; null when it could not be read or the table is not set up).
export default function ChatbotPlugin({ place = "app", connected = null }) {
  const app = place === "app";
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name="MessageSquareText" size={20} /></span>
        <div className="min-w-0">
          <h2 id={app ? "plugin-heading" : undefined} className={app ? "text-lg font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>Use Hushwork from Claude</h2>
          <p className="mt-1 text-[15px] text-mute">Ask Claude to make an agent, run it, or tell you what is waiting. Anything that sends or creates still waits for your yes.</p>
        </div>
      </div>
      <div className="mt-4"><CopyAddress /></div>
      <ol className="mt-4 space-y-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm">
            <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold">{index + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-mute">In Claude Code, run <code className="rounded bg-raised px-1.5 py-0.5 text-[13px] text-ink">/plugin marketplace add shivalikathuria80-gif/hushwork</code></p>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {app ? (
          <>
            <p className="flex-1 text-sm">
              {connected === null ? "Manage chatbots and API tokens in Settings." : connected === 0 ? "No chatbot is connected yet." : `${connected} ${connected === 1 ? "chatbot is" : "chatbots are"} connected.`}
            </p>
            <Link href="/app/settings#plugin-settings" className="text-sm font-medium text-accent-text hover:underline">Manage in Settings</Link>
          </>
        ) : (
          <>
            <p className="flex-1 text-sm text-mute">Free with your Hushwork account.</p>
            <Btn href="/login#create" size="sm" iconRight="ArrowRight">Sign up free</Btn>
          </>
        )}
      </div>
    </div>
  );
}
