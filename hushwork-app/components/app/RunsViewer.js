import { Btn, StepRow } from "../ui";
import { Icon } from "../icons";
import { ApprovalSample, PauseSample } from "../Features";

// The runs page: a list on the left, the detail of the selected run on the right (stacked on phones).
// Honest by design: nothing has ever run, so the real list is an empty state. The only run shown is a SAMPLE,
// labelled as such everywhere, with placeholder values only. It is a constant in this file, stored nowhere.
// The sample's list item is deliberately not a button: there is only one thing to select, so a button would
// pretend to do something.

const chip = "rounded-md border border-field bg-surface px-1.5 text-xs font-medium uppercase tracking-wide text-ink";

const SAMPLE_STEPS = [
  ["Zap", "Trigger", "Invoice 14 days overdue", "0.1s"],
  ["CreditCard", "Check Stripe", "No payment found", "0.8s"],
  ["PenLine", "Draft reminder", "Polite, firm, your tone", "2.1s"],
  ["ShieldCheck", "Approval", "Waiting for you", null],
];

export default function RunsViewer() {
  return (
    <div className="mt-8 md:flex">
      <div className="md:w-72 md:shrink-0 md:border-r md:border-line md:pr-6">
        <h2 className="text-lg font-semibold tracking-tight">Your runs</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent-text"><Icon name="History" size={18} /></span>
          <p className="mt-3 font-semibold">Nothing has run yet.</p>
          <p className="mt-1 text-sm leading-relaxed text-mute">Hushwork does not run workflows yet. When it does, each run will be listed here with every step it took.</p>
          <Btn href="/app" size="sm" variant="secondary" className="mt-4">Preview a plan</Btn>
        </div>

        <h2 className="mt-8 text-lg font-semibold tracking-tight">Example</h2>
        <ul className="mt-3">
          <li aria-current="true" className="relative rounded-xl bg-raised px-4 py-3 before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-text">
            <span className="flex flex-wrap items-center gap-2"><b className="font-medium">Chase overdue invoices</b><span className={chip}>Sample</span></span>
            <span className="mt-1 block text-sm text-mute">3 steps done, 1 waiting</span>
          </li>
        </ul>
      </div>

      <section aria-labelledby="sample-heading" className="mt-10 min-w-0 flex-1 md:mt-0 md:pl-8">
        <div className="flex items-start gap-3 rounded-xl border border-field bg-raised p-3">
          <span className={chip}>Sample</span>
          <p className="text-sm">This is an example run. Nothing here happened.</p>
        </div>
        <h2 id="sample-heading" className="mt-5 text-lg font-semibold tracking-tight">Chase overdue invoices</h2>
        <p className="mt-1 text-[15px] text-mute">3 steps done. 1 step waiting for your approval.</p>

        <h3 className="mt-6 text-sm font-medium">Steps</h3>
        <ol className="mt-1 space-y-0.5">
          {SAMPLE_STEPS.map(([icon, title, detail, duration]) => (
            <StepRow
              key={title} icon={icon} title={title} sub={detail}
              right={duration ? (
                <span className="flex items-center gap-2">
                  <span className="text-accent-text"><Icon name="Check" size={14} /></span>
                  <span className="font-mono text-xs tabular-nums text-mute">{duration}</span>
                </span>
              ) : <span className="text-sm text-mute">Waiting</span>}
            />
          ))}
        </ol>

        <h3 className="mt-6 text-sm font-medium">Needs your approval</h3>
        <div className="mt-2">
          <ApprovalSample
            heading="Sample approval"
            body="Client A, Client B and Client C are overdue by 3 to 14 days."
            approvedText="Approved. In a real run these would send at 9:00. Nothing was sent."
            skippedText="Skipped. Nothing was sent."
          />
        </div>

        <h3 className="mt-6 text-sm font-medium">Pause</h3>
        <div className="mt-2">
          <PauseSample
            name="Invoice chaser (sample)" label="Invoice chaser (sample)"
            runningText="Sample switch. It only changes this page."
            pausedText="Sample switch. It only changes this page."
          />
        </div>
      </section>
    </div>
  );
}
