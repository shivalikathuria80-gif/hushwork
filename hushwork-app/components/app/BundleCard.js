import Link from "next/link";
import { Icon } from "../icons";
import EnableBundle from "./EnableBundle";

// One Skill Bundle on the Skills page: what it is, which apps it needs (and whether they are connected), exactly what each skill can read and write, and the ready-made
// workflows. A server component with plain props, so the page and a preview can both use it. `states` maps an app id to true, false, null (could not be checked) or "unavailable".
const chip = "rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink";
const ACCESS = {
  read: ["Reads only", "Eye"],
  write: ["Writes: needs your Approve", "ShieldCheck"],
  think: ["AI writes text", "PenLine"],
  control: ["Stop sign", "ShieldCheck"],
};

export default function BundleCard({ info, on, disabled = false, states }) {
  return (
    <li className="flex flex-col rounded-2xl border border-line-strong bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={info.icon} size={20} /></span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-[1.35] tracking-tight">{info.name} <span className={on ? "ml-1 rounded-md border border-accent bg-accent-subtle px-2 align-middle text-xs font-medium text-accent-text" : `ml-1 align-middle ${chip}`}>{on ? "On" : "Off"}</span></h2>
            <p className="mt-1 text-[15px] text-mute">{info.blurb}</p>
          </div>
        </div>
        <EnableBundle bundleId={info.id} name={info.name} enabled={on} disabled={disabled} />
      </div>

      <h3 className="mt-5 text-sm font-medium">Apps it needs</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {info.connections.map((connection) => {
          const state = states[connection.id];
          return (
            <li key={connection.id} className={chip}>
              {connection.name}: {state === "unavailable" ? "cannot be connected yet" : state === true ? "connected" : state === false ? "not connected" : "not checked"}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-mute">A skill only works once its app is connected. <Link href="/app/connections" className="font-medium text-accent-text hover:underline">Open Connections</Link>. Turning the bundle on works without them.</p>

      <details className="mt-5 rounded-xl border border-line bg-raised p-3">
        <summary className="min-h-6 cursor-pointer text-sm font-medium">What the {info.skills.length} skills can read and write</summary>
        <ul className="mt-3 space-y-3">
          {info.skills.map((one) => (
            <li key={one.id} className="rounded-xl border border-line bg-surface p-3">
              <p className="flex flex-wrap items-center gap-2"><Icon name={one.icon} size={16} className="text-accent-text" /><b className="font-medium">{one.name}</b><span className={chip}><Icon name={ACCESS[one.access][1]} size={12} className="mr-1 inline" />{ACCESS[one.access][0]}</span></p>
              <p className="mt-1 text-sm text-mute">{one.about}</p>
              {one.reads && <p className="mt-1 text-sm"><b className="font-medium">Reads:</b> {one.reads}</p>}
              {one.writes && <p className="mt-1 text-sm"><b className="font-medium">Writes:</b> {one.writes}</p>}
            </li>
          ))}
        </ul>
      </details>

      <h3 className="mt-5 text-sm font-medium">Ready-made workflows ({info.workflows.length})</h3>
      <ul className="mt-2 space-y-2">
        {info.workflows.map((workflow) => (
          <li key={workflow.id} className="rounded-xl border border-line p-3">
            <p className="font-medium">{workflow.title} <span className="font-mono text-xs font-normal text-mute">{workflow.steps} steps</span></p>
            <p className="mt-1 text-sm text-mute">{workflow.body}</p>
            {workflow.schedule && <p className="mt-1 flex items-start gap-1.5 text-sm"><Icon name="Clock" size={16} className="mt-0.5 shrink-0 text-mute" /><span><b className="font-medium">Suggested schedule:</b> {workflow.schedule}. To use it, open the workflow in the Builder and press Save.</span></p>}
          </li>
        ))}
      </ul>
    </li>
  );
}
