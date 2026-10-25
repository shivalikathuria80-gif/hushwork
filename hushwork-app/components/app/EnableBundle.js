"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import Link from "next/link";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { enableSkillBundle, disableSkillBundle } from "@/lib/actions/skills";

// The one-click switch on a Skill Bundle card. Turning a bundle on saves its ready-made workflows to your Workflows list. It connects nothing, makes no
// schedule and runs nothing. Turning it off keeps those workflows.
export default function EnableBundle({ bundleId, name, enabled, disabled = false }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError("");
    setMessage("");
    startTransition(async () => {
      let result;
      try {
        result = await (enabled ? disableSkillBundle : enableSkillBundle)({ bundleId });
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not reach Hushwork. Check your connection and try again." };
      }
      if (result.error) return setError(result.error);
      if (!enabled && !result.already) {
        const saved = result.saved ?? [];
        const skipped = result.skipped ?? [];
        setMessage(`${name} is on.${saved.length ? ` Saved ${saved.length === 1 ? "1 workflow" : `${saved.length} workflows`} to your list: ${saved.join(", ")}.` : ""}${skipped.length ? ` Already in your list: ${skipped.join(", ")}.` : ""}`);
      }
      router.refresh();
    });
  }

  return (
    <div>
      {enabled ? (
        <Btn variant="secondary" size="sm" icon="X" loading={pending} onClick={toggle} aria-label={`Turn off ${name}`}>Turn off</Btn>
      ) : (
        <Btn size="sm" icon="Plus" loading={pending} disabled={disabled} onClick={toggle} aria-label={`Turn on ${name}`}>Turn on</Btn>
      )}
      {message && (
        <p role="status" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleCheck" className="mt-0.5 shrink-0 text-success" /><span>{message} <Link href="/app/workflows" className="font-medium text-accent-text hover:underline">Open Workflows</Link></span></p>
      )}
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
