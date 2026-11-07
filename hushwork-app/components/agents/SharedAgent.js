"use client";

import { useSyncExternalStore } from "react";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { cleanShared, sharedSignupHref } from "@/lib/shared-agent";

const subscribeToNothing = () => () => {};

// The body of /agents/try: the shared sentence, shown as plain text (React escapes it), and one button that goes through sign-up to the
// Agents page with the sentence in the box. Nothing is made there until the person presses Create agent.
export default function SharedAgent() {
  const sentence = useSyncExternalStore(subscribeToNothing, () => cleanShared(new URLSearchParams(window.location.search).get("a")), () => null);
  if (sentence === null) return <div aria-busy="true" className="h-64" />;
  if (!sentence) {
    return (
      <section className="mx-auto max-w-2xl text-center">
        <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">This share link is empty</h1>
        <p className="mt-3 text-[15px] text-mute">The link may have been cut off. Ask for it again, or pick one of the ready-made agents.</p>
        <Btn href="/agents" className="mt-6" icon="Bot">See ready-made agents</Btn>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-accent-text">Shared with you</p>
      <h1 tabIndex={-1} className="mt-2 text-[length:clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.01em]">Someone shared a Hushwork agent with you</h1>
      <figure className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <figcaption className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mute"><Icon name="Bot" size={14} />The agent, in their words</figcaption>
        <blockquote className="mt-2 whitespace-pre-wrap break-words text-[17px] leading-relaxed text-ink">{sentence}</blockquote>
      </figure>
      <ul className="mt-6 grid gap-2 text-[15px] text-mute">
        <li className="flex items-start gap-2"><Icon name="ShieldCheck" size={18} className="mt-0.5 shrink-0 text-accent-text" />Hushwork turns the sentence into steps you can read first. Nothing is made until you press Create agent.</li>
        <li className="flex items-start gap-2"><Icon name="ShieldCheck" size={18} className="mt-0.5 shrink-0 text-accent-text" />Any step that sends or creates something waits for your Approve.</li>
        <li className="flex items-start gap-2"><Icon name="CircleAlert" size={18} className="mt-0.5 shrink-0" />This was written by whoever sent you the link, not by Hushwork. Change it if anything looks wrong.</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-2">
        <Btn href={sharedSignupHref(sentence)} icon="Bot">Make this agent free</Btn>
        <Btn href="/agents" variant="secondary">See ready-made agents</Btn>
      </div>
    </section>
  );
}
