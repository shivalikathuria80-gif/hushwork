"use client";

import { useState } from "react";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { alternativeFor, capabilityOf, requirementOf } from "@/lib/studio/capabilities";

// The Workflow Studio card under a step: WHY the step exists, HOW it runs (which skill and plugin), the EVIDENCE it leaves, and what to do if it fails.
// It also warns, in place, when an app the step needs is not connected, with the next actions: connect it, choose another way, or remove the step.
//
// `step`         the typed step ({ kind, fields }). A free-text note gets a one-line card.
// `connections`  { [id]: true | false | null | "unavailable" } from lib/skills/connection-status.js, or undefined when it was not checked (no warning is shown then).
// `evidence`     { state: "planned" | "verified" | "failed" | "unknown", text }: what is TRUE about this step. "planned" is only what the workflow intends; only
//                "verified" is a result that really happened (a saved record of the run). In the Builder it is always planned.
// `onRemove`, `onChoose(fields)`, `onCheckAgain`   optional: they show the matching buttons (the Builder passes them; the Runs page does not).
const EVIDENCE = {
  planned: ["Planned", "Nothing has run yet. This is what the workflow intends to do."],
  verified: ["Verified", "This really happened. The result below was saved when it ran."],
  failed: ["Failed", "It stopped here. The reason is saved with the run."],
  unknown: ["Not sure", "It was started but Hushwork never saw it finish, so it may have happened."],
};
const chip = "rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink";

export default function StepStudioCard({ step, connections, evidence = { state: "planned", text: "" }, onRemove, onChoose, onCheckAgain, busy = false }) {
  const [open, setOpen] = useState(false);
  const info = capabilityOf(step);
  const need = requirementOf(step, connections);
  const alternative = alternativeFor(step);
  const [evidenceLabel, evidenceWords] = EVIDENCE[evidence.state] ?? EVIDENCE.planned;
  const blocked = need.status === "missing_connection" || need.status === "unavailable";

  return (
    <div className="mt-3 rounded-xl border border-line bg-raised p-3 text-sm">
      {blocked && (
        <div role="alert" className="mb-3 rounded-lg border border-error bg-surface p-3">
          <p className="flex items-start gap-2 font-medium"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />
            {need.status === "unavailable" ? `${need.missing.map((one) => one.name).join(", ")} cannot be connected yet.` : `${need.missing.map((one) => one.name).join(" and ")} ${need.missing.length === 1 ? "is" : "are"} not connected, so this step cannot run yet.`}
          </p>
          {need.status === "unavailable" && need.missing[0]?.reason && <p className="mt-1 text-mute">{need.missing[0].reason}</p>}
          <p className="mt-1 text-mute">You can save the workflow anyway. Pick what to do:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {need.status === "missing_connection" && (
              <Btn size="sm" href="/app/connections" target="_blank" rel="noopener" icon="Plug">Connect {need.missing.map((one) => one.name).join(" and ")} (new tab)</Btn>
            )}
            {need.status === "missing_connection" && onCheckAgain && <Btn size="sm" variant="secondary" onClick={onCheckAgain} disabled={busy}>I connected it: check again</Btn>}
            {alternative && onChoose && <Btn size="sm" variant="secondary" onClick={() => onChoose(alternative.fields)} disabled={busy}>{alternative.label}</Btn>}
            {onRemove && <Btn size="sm" variant="ghost" icon="Trash" onClick={onRemove} disabled={busy}>Remove this step</Btn>}
          </div>
        </div>
      )}
      {need.status === "unknown" && need.missing.length > 0 && (
        <p className="mb-3 flex items-start gap-2 text-mute"><Icon name="Info" className="mt-0.5 shrink-0 text-info" />Could not check whether {need.missing.map((one) => one.name).join(" and ")} {need.missing.length === 1 ? "is" : "are"} connected. <a href="/app/connections" target="_blank" rel="noopener" className="font-medium text-accent-text hover:underline">Open Connections</a>.</p>
      )}
      {need.status === "ready" && info.plugins.length > 0 && connections && (
        <p className="mb-2 flex items-center gap-2 text-mute"><Icon name="CircleCheck" className="shrink-0 text-success" />Ready: the app this step needs is connected.</p>
      )}

      <p><b className="font-medium">Why:</b> {info.why}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <b className="font-medium">Evidence:</b>
        <span className={chip}>{evidenceLabel}</span>
        <span className="text-mute">{evidence.text || evidenceWords}</span>
      </p>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-2 inline-flex min-h-8 items-center gap-1 font-medium text-accent-text hover:underline">
        <Icon name="ChevronDown" size={14} className={open ? "rotate-180" : ""} />{open ? "Hide details" : "How it runs and what if it fails"}
      </button>
      {open && (
        <dl className="mt-2 space-y-1.5">
          <div><dt className="inline font-medium">How: </dt><dd className="inline">{info.how}</dd></div>
          <div><dt className="inline font-medium">Produces: </dt><dd className="inline">{info.output}</dd></div>
          <div><dt className="inline font-medium">If it fails: </dt><dd className="inline">{info.onFailure}</dd></div>
        </dl>
      )}
    </div>
  );
}
