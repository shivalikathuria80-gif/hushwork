import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DraftList from "./DraftList";

// "Your drafts". It reads the session and the database, so the page wraps it in <Suspense>: everything above it
// appears first, and this section streams in. It re-checks who you are (requireUser) right next to the data;
// the database's own rules are the third check.

const intro = "Drafts are saved plans. They never run, send or connect to anything.";

// What shows while the list loads. The heading is the same, so nothing above or below it moves.
export function DraftsFallback() {
  return (
    <div aria-busy="true">
      <h2 id="drafts-heading" tabIndex={-1} className="text-xl font-semibold leading-[1.35] tracking-tight outline-offset-4">Your drafts</h2>
      <p className="mt-1 text-[15px] text-mute">{intro}</p>
      <p role="status" className="sr-only">Loading your drafts</p>
      <div aria-hidden="true" className="mt-3 space-y-3">
        {[0, 1, 2].map((row) => <div key={row} className="h-[68px] rounded-2xl border border-line bg-raised" />)}
      </div>
    </div>
  );
}

// Rebuilds each row from scratch with plain strings, so nothing unexpected is handed to the browser.
const text = (value) => (typeof value === "string" ? value : "");
function toDraft(row) {
  const plan = Array.isArray(row.plan) ? row.plan : [];
  return {
    id: row.id,
    name: text(row.name),
    prompt: text(row.prompt),
    updatedAt: text(row.updated_at),
    plan: plan.map((step) => ({ icon: text(step?.icon), title: text(step?.title), detail: text(step?.detail) })),
  };
}

export default async function Drafts() {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected

  let drafts = [];
  let loadFailed = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workflows")
      .select("id, name, prompt, plan, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("Loading drafts failed:", error.code);
      loadFailed = true;
    } else {
      drafts = data.map(toDraft);
    }
  } catch {
    loadFailed = true; // for example the Supabase settings are missing or the network is down
  }

  return (
    <div>
      <h2 id="drafts-heading" tabIndex={-1} className="text-xl font-semibold leading-[1.35] tracking-tight outline-offset-4">
        Your drafts{!loadFailed && drafts.length > 0 && <span className="ml-1 font-normal text-mute">({drafts.length})</span>}
      </h2>
      <p className="mt-1 text-[15px] text-mute">{intro}</p>
      <DraftList drafts={drafts} loadFailed={loadFailed} />
    </div>
  );
}
