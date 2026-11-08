import { Icon } from "../icons";
import CalendarBoard from "./CalendarBoard";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedResults } from "@/lib/run-engine";
import { buildWeekRecap } from "@/lib/week-recap";

// "Calendar": the server half. It reads the person's workflows, their schedules and the last day of runs, and hands plain values to
// CalendarBoard, which lays them out in the visitor's own time zone (the server cannot know it). The page wraps this in <Suspense>.

const text = (value) => (typeof value === "string" ? value : "");
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const clock = () => Date.now(); // read once per request

export function CalendarFallback() {
  return (
    <div aria-busy="true" className="mt-8 space-y-4">
      <p role="status" className="sr-only">Loading your calendar</p>
      <div aria-hidden="true" className="h-36 rounded-[20px] border border-line bg-raised" />
      <div aria-hidden="true" className="h-[420px] rounded-[20px] border border-line bg-raised" />
    </div>
  );
}

function Problem({ children }) {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
      <Icon name="CircleAlert" className="text-error" />
      <p className="mt-2 font-semibold">Your calendar could not be shown</p>
      <p className="mt-1 text-sm text-mute">{children}</p>
    </div>
  );
}

export default async function CalendarData() {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected
  const now = clock();
  let items = [];
  let runs = [];
  let schedulesMissing = false;
  let failure = "";
  try {
    const supabase = await createClient();
    const [flows, schedules, recent] = await Promise.all([
      supabase.from("workflows").select("id, name").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
      supabase.from("schedules").select("workflow_id, frequency, hour, minute, weekday, tz_offset, allow_writes, enabled").eq("user_id", user.id).limit(100),
      supabase.from("runs").select("id, workflow_id, workflow_name, mode, results, created_at").eq("user_id", user.id)
        .gte("created_at", new Date(now - DAY_MS).toISOString()).order("created_at", { ascending: false }).limit(200),
    ]);
    if (flows.error) {
      console.error("Loading the calendar failed:", flows.error.code);
      failure = NO_TABLE.has(flows.error.code) ? "Hushwork's database is not set up yet. Run the files in the supabase folder first." : "Check your connection and try again.";
    } else {
      const names = new Map(flows.data.map((row) => [text(row.id), text(row.name) || "Untitled workflow"]));
      if (schedules.error) schedulesMissing = NO_TABLE.has(schedules.error.code);
      else items = schedules.data.filter((row) => names.has(text(row.workflow_id))).map((row) => ({
        workflowId: text(row.workflow_id),
        name: names.get(text(row.workflow_id)),
        schedule: {
          frequency: text(row.frequency), hour: Number(row.hour) || 0, minute: Number(row.minute) || 0, weekday: Number(row.weekday) || 0,
          tzOffset: Number(row.tz_offset) || 0, allowWrites: row.allow_writes === true, enabled: row.enabled !== false,
        },
      }));
      if (!recent.error) {
        const rows = recent.data.map((row) => ({ id: text(row.id), workflowId: text(row.workflow_id), name: text(row.workflow_name), live: row.mode === "live", createdAt: text(row.created_at), results: readSavedResults(row.results) }));
        runs = buildWeekRecap(rows, now).runDots;
      }
    }
  } catch {
    failure = "Check your connection and try again.";
  }
  if (failure) return <Problem>{failure}</Problem>;
  return <CalendarBoard items={items} runs={runs} schedulesMissing={schedulesMissing} />;
}
