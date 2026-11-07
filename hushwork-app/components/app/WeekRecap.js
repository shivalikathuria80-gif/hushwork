import Link from "next/link";
import { Btn } from "../ui";
import { Icon } from "../icons";
import RunTime from "./RunTime";
import { CountUp, Reveal, RevealItem } from "./RunMotion";
import { SpotlightCard, TimeUp, WeekChart, WeekPulse, GrowBar } from "./WeekFx";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedResults, SETUP_MESSAGE } from "@/lib/run-engine";
import { buildWeekRecap, weekLine, MINUTES, WEEK_MS } from "@/lib/week-recap";

// "Your week": what Hushwork did in the last 7 days, from the runs table (lib/week-recap.js does the counting).
// It reads the session and the database, so the page wraps it in <Suspense>.

const LIMIT = 400; // the newest runs looked at; a busier week says so instead of guessing
const clock = () => Date.now(); // read once per request
const text = (value) => (typeof value === "string" ? value : "");

export function WeekFallback() {
  return (
    <div aria-busy="true" className="mt-8 space-y-4">
      <p role="status" className="sr-only">Loading your week</p>
      <div aria-hidden="true" className="h-40 rounded-2xl border border-line bg-raised" />
      <div aria-hidden="true" className="h-[320px] rounded-2xl border border-line bg-raised" />
    </div>
  );
}

function Stat({ icon, label, children, hint }) {
  return (
    <RevealItem className="h-full">
      <SpotlightCard className="h-full p-4">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={icon} size={16} /></span>
        <p className="mt-3 text-2xl font-bold tracking-tight">{children}</p>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-mute">{hint}</p>}
      </SpotlightCard>
    </RevealItem>
  );
}

const PILL = { you: ["bg-accent", "Needs your OK"], bad: ["bg-error", "Stopped"] };

export default async function WeekRecap() {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected
  const now = clock();
  let rows = [];
  let failure = "";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("runs")
      .select("id, workflow_id, workflow_name, mode, results, created_at")
      .eq("user_id", user.id)
      .gte("created_at", new Date(now - WEEK_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (error) {
      console.error("Loading the week failed:", error.code);
      failure = error.code === "42P01" || error.code === "PGRST205" ? SETUP_MESSAGE : "Could not load your week. Check your connection and try again.";
    } else {
      rows = data.map((row) => ({ id: text(row.id), workflowId: text(row.workflow_id), name: text(row.workflow_name), live: row.mode === "live", createdAt: text(row.created_at), results: readSavedResults(row.results) }));
    }
  } catch {
    failure = "Could not load your week. Check your connection and try again.";
  }

  if (failure) {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <Icon name="CircleAlert" className="text-error" />
        <p className="mt-2 font-semibold">Your week could not be shown</p>
        <p className="mt-1 text-sm text-mute">{failure}</p>
      </div>
    );
  }

  const recap = buildWeekRecap(rows, now);
  const empty = recap.runs === 0 && recap.quiet === 0;
  const most = Math.max(1, ...recap.byWorkflow.map((group) => group.total));

  return (
    <>
      <WeekPulse good={recap.stepsDone > 0} />
      <Reveal className="mt-8 grid gap-4">
        {/* The headline: time given back, with the guess spelled out. */}
        <RevealItem>
          <SpotlightCard beam className="p-5 sm:p-6">
            <p className="text-sm font-medium text-mute">Time Hushwork gave back, last 7 days</p>
            <p className="mt-1 text-[length:clamp(2.5rem,6vw,3.75rem)] font-bold leading-none tracking-[-0.03em]">
              <span className="hw-shimmer-text">~<TimeUp minutes={recap.minutes} /></span>
            </p>
            <p className="mt-3 max-w-[60ch] text-[15px]">{weekLine(recap)}</p>
            <p className="mt-2 text-xs text-mute">
              A rough guess, never a measurement: {MINUTES.read} minutes for each thing it read for you, {MINUTES.ai} for each AI write-up, {MINUTES.write} for each thing it sent or created, and {MINUTES.quiet} for each quiet check.
              {rows.length >= LIMIT && ` Only your newest ${LIMIT} runs are counted.`}
            </p>
          </SpotlightCard>
        </RevealItem>

        <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-4" delay={0.15}>
          <Stat icon="Play" label="Runs"><CountUp value={recap.runs} /></Stat>
          <Stat icon="CircleCheck" label="Steps done for real" hint={[recap.reads && `${recap.reads} read`, recap.ai && `${recap.ai} AI write-ups`, recap.writes && `${recap.writes} sent`].filter(Boolean).join(", ") || "Approve a step to start"}><CountUp value={recap.stepsDone} /></Stat>
          <Stat icon="Send" label="Sent or created" hint="Each one after your OK"><CountUp value={recap.writes} /></Stat>
          <Stat icon="Eye" label="Quiet checks" hint="Looked, found nothing new"><CountUp value={recap.quiet} /></Stat>
        </Reveal>

        <RevealItem>
          <SpotlightCard as="section" aria-labelledby="days-heading" className="p-4 sm:p-5">
            <h2 id="days-heading" className="text-lg font-semibold tracking-tight">Day by day</h2>
            <p className="text-sm text-mute">One dot for each run, quiet checks included. Point at a day to light it up.</p>
            <WeekChart dots={recap.dots} />
          </SpotlightCard>
        </RevealItem>
      </Reveal>

      {empty ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="font-semibold">Nothing ran this week yet.</p>
          <p className="mt-1 text-sm text-mute">Describe a chore on the home page, or give an agent a schedule. Every run shows up here.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn href="/app" size="sm" icon="Plus">New workflow</Btn>
            <Btn href="/app/agents" size="sm" variant="secondary" icon="Bot">Agents</Btn>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SpotlightCard as="section" aria-labelledby="needs-heading" className="p-4 sm:p-5">
            <h2 id="needs-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {recap.needsYou.length > 0 && <span aria-hidden="true" className="hw-pulse-dot h-2 w-2 rounded-full bg-accent" />}Needs you
            </h2>
            {recap.needsYou.length === 0 ? (
              <p className="mt-2 text-sm text-mute">Nothing is waiting. Every run this week finished or stayed a practice run.</p>
            ) : (
              <Reveal as="ul" className="mt-3 space-y-2">
                {recap.needsYou.map((run) => (
                  <RevealItem as="li" key={run.id}>
                    <Link href={`/app/runs?run=${run.id}`} className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent-edge hover:bg-accent-subtle">
                      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${PILL[run.tone][0]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{run.name}</span>
                        <span className="block text-xs text-mute">{PILL[run.tone][1]}{run.waiting > 1 ? ` (${run.waiting} steps)` : ""} · <RunTime iso={run.createdAt} /></span>
                      </span>
                      <span className="text-mute transition-transform duration-200 group-hover:translate-x-0.5"><Icon name="ArrowRight" size={16} /></span>
                    </Link>
                  </RevealItem>
                ))}
              </Reveal>
            )}
          </SpotlightCard>

          <SpotlightCard as="section" aria-labelledby="flows-heading" className="p-4 sm:p-5">
            <h2 id="flows-heading" className="text-lg font-semibold tracking-tight">Busiest workflows</h2>
            <ul className="mt-3 space-y-3">
              {recap.byWorkflow.map((group) => (
                <li key={group.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{group.name}</span>
                    <span className="shrink-0 tabular-nums text-mute">{group.total} {group.total === 1 ? "run" : "runs"}</span>
                  </div>
                  <div className="mt-1.5"><GrowBar parts={group} total={group.total} most={most} /></div>
                  <p className="sr-only">{[group.good && `${group.good} done`, group.you && `${group.you} waiting for you`, group.bad && `${group.bad} stopped`, group.preview && `${group.preview} practice only`, group.quiet && `${group.quiet} quiet checks`].filter(Boolean).join(", ")}</p>
                </li>
              ))}
            </ul>
          </SpotlightCard>
        </div>
      )}
    </>
  );
}
