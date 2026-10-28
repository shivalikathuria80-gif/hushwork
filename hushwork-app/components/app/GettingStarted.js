import Link from "next/link";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Getting started": three steps for a brand-new person, ticked from what they have really done (not from a setting they could forget).
// It shows nothing once all three are done, and nothing at all if the database cannot be read. It reads the session, so the page wraps it in <Suspense>.
async function count(query) {
  const { count: total, error } = await query;
  return error ? null : total ?? 0;
}

export default async function GettingStarted() {
  const user = await requireUser();
  const supabase = await createClient();
  const [workflows, runs, liveRuns] = await Promise.all([
    count(supabase.from("workflows").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
    count(supabase.from("runs").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
    count(supabase.from("runs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("mode", "live")),
  ]);
  if (workflows === null || runs === null || liveRuns === null || liveRuns > 0) return null;

  const steps = [
    { done: workflows > 0, title: "Say what you want", text: "Type a chore in the box below, or tap an example. You get a plan; nothing runs yet.", href: "#task", link: "Go to the box" },
    { done: runs > 0, title: "Practice it", text: "Open your draft in the Builder and press Run. A practice run only looks; it sends and creates nothing.", href: "/app/workflows", link: "Open my drafts" },
    { done: liveRuns > 0, title: "Approve one step", text: "On the Runs page, read the exact words of a step and press Approve. Nothing is sent or created before that.", href: "/app/runs", link: "Open Runs" },
  ];
  const next = steps.findIndex((step) => !step.done);

  return (
    <section aria-labelledby="start-heading" className="mb-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 id="start-heading" className="text-lg font-semibold tracking-tight">Getting started: 3 small steps</h2>
      <ol className="mt-3 space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <Icon name={step.done ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${step.done ? "text-success" : "text-mute"}`} />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{index + 1}. {step.title}{step.done && <span className="sr-only"> (done)</span>}</p>
              <p className="text-mute">{step.text}</p>
              {index === next && <Link href={step.href} className="mt-1 inline-block font-medium text-accent-text hover:underline">{step.link}</Link>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
