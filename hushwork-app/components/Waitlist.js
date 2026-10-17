"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Btn, EASE, Reveal } from "./ui";
import { Icon } from "./icons";
import { joinWaitlist } from "@/lib/waitlist";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | ok | duplicate | error | not-connected
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef(null);
  const trap = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setInvalid(true); inputRef.current.focus(); return; }
    setInvalid(false);
    if (trap.current && trap.current.value) { setStatus("ok"); return; } // a hidden field only bots fill in
    setStatus("sending");
    setStatus(await joinWaitlist(email.trim()));
  };

  const finished = status === "ok" || status === "duplicate";
  const problem = invalid
    ? "Enter a valid email address, like you@company.com."
    : status === "error"
      ? "That did not go through. Check your connection and try again."
      : status === "not-connected"
        ? "The waitlist is not connected yet, so your email was not saved. Please check back soon."
        : "";

  return (
    <section id="wait" className="px-5 pb-12 md:px-12">
      <Reveal>
        <div className="on-accent mx-auto max-w-6xl rounded-3xl bg-accent px-6 py-16 text-center text-on-accent md:py-20">
          <h2 className="text-[length:clamp(2rem,5vw,2.75rem)] font-semibold tracking-tight">Get your week back.</h2>
          <p className="mt-3 text-lg text-on-accent/90">Join the waitlist for early access.</p>
          <AnimatePresence mode="wait" initial={false}>
            {finished ? (
              <motion.p key="done" role="status" className="mx-auto mt-8 inline-flex max-w-md items-center gap-2 rounded-xl bg-accent-active px-5 py-3 text-left font-semibold"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2, ease: EASE }}>
                <Icon name="CircleCheck" size={20} className="shrink-0" />
                {status === "ok" ? "You’re on the list. We’ll email you when early access opens." : "You’re already on the list. Nothing more to do."}
              </motion.p>
            ) : (
              <motion.form key="form" onSubmit={submit} noValidate className="relative mx-auto mt-8 max-w-md text-left" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <label htmlFor="wait-email" className="mb-2 block text-sm font-medium">Email address</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="wait-email" ref={inputRef} type="email" inputMode="email" autoComplete="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); if (invalid) setInvalid(false); }}
                    placeholder="you@company.com" aria-invalid={invalid || undefined} aria-describedby={problem ? "wait-error wait-privacy" : "wait-privacy"}
                    className="h-12 w-full min-w-0 rounded-xl bg-surface px-4 text-[15px] text-ink placeholder:text-hint sm:w-auto sm:flex-1"
                  />
                  <Btn type="submit" variant="dark" size="lg" loading={status === "sending"} className="w-full sm:w-auto">Join the waitlist</Btn>
                </div>
                <input ref={trap} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
                {problem && (
                  <motion.p id="wait-error" role="alert" className="mt-3 flex items-start gap-2 text-sm" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Icon name="CircleAlert" className="mt-1 shrink-0" />{problem}
                  </motion.p>
                )}
                <p id="wait-privacy" className={`text-sm text-on-accent/90 ${problem ? "mt-2" : "mt-3"}`}>
                  We only use your email to tell you when early access opens. <Link href="/privacy" className="text-on-accent underline underline-offset-4">Privacy</Link>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
