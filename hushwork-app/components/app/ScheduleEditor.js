"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { saveSchedule, deleteSchedule, syncScheduleFromStart } from "@/lib/actions/schedules";
import { parseWhen } from "@/lib/schedule-text";
import { FREQUENCIES, WEEKDAYS, describeSchedule } from "@/lib/schedule";
import { niceTime } from "@/lib/connectors/time-format";

// The Schedule panel under a workflow on the Workflows page: say WHEN it should run by itself (every hour, day, weekday or week, at a time
// of the person's own day) and whether a scheduled run may also WRITE (add a row, create a task). Writing is off unless this box is ticked,
// because nobody is there to approve it. The clock that actually runs it is explained in docs/deploy.md; `clockReady` says whether the
// two settings it needs are in place, so the panel can say so honestly instead of promising something that will not happen.
const field = "h-11 w-full rounded-xl border border-field bg-surface px-3 text-[15px] focus-visible:border-accent";
const pad = (n) => String(n).padStart(2, "0");

async function call(action, input, fallback) {
  try {
    return await action(input);
  } catch (problem) {
    unstable_rethrow(problem);
    return { error: fallback };
  }
}

export default function ScheduleEditor({ workflowId, schedule, tableMissing, clockReady, startWhen = "" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState(schedule?.frequency ?? "weekdays");
  const [time, setTime] = useState(schedule ? `${pad(schedule.hour)}:${pad(schedule.minute)}` : "09:00");
  const [minutePast, setMinutePast] = useState(schedule?.minute ?? 0);
  const [weekday, setWeekday] = useState(schedule?.weekday ?? 1);
  const [allowWrites, setAllowWrites] = useState(schedule?.allowWrites ?? false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const send = (extra = {}) => {
    const [hour, minute] = time.split(":").map(Number);
    return {
      workflowId, frequency, hour: frequency === "hourly" ? 0 : hour, minute: frequency === "hourly" ? Number(minutePast) : minute, weekday: Number(weekday),
      tzOffset: -new Date().getTimezoneOffset(), allowWrites, enabled: schedule?.enabled ?? true, ...extra,
    };
  };
  function run(action, input, fallback, done) {
    setError("");
    startTransition(async () => {
      const result = await call(action, input, fallback);
      if (result.error) setError(result.error);
      else { done?.(); router.refresh(); }
    });
  }

  // The Start step in the Builder says WHEN in words. If those words and the schedule that really runs disagree, say so (the schedule here wins).
  const asked = startWhen ? parseWhen(startWhen) : null;
  const differs = asked && schedule && (asked.frequency !== schedule.frequency || asked.minute !== schedule.minute || (asked.frequency !== "hourly" && asked.hour !== schedule.hour) || (asked.frequency === "weekly" && asked.weekday !== schedule.weekday));
  const mismatch = !startWhen ? ""
    : !asked ? `The Start step says "${startWhen.slice(0, 40)}", but that time could not be read, so it is not used. In the Builder write it like "Every Monday at 9:00".`
    : !schedule ? `The Start step says "${startWhen.slice(0, 40)}", but nothing is scheduled yet.`
    : differs ? `The Start step says "${startWhen.slice(0, 40)}", but the schedule that really runs is "${describeSchedule(schedule)}". The schedule shown here is the one that runs.`
    : "";

  const summary = schedule && (
    <p className="mt-1 text-sm text-mute">
      {describeSchedule(schedule)}{!schedule.enabled && " (paused)"}.
      {schedule.enabled && schedule.nextRunAt && <> Next run: {niceTime(Date.parse(schedule.nextRunAt), { offset: schedule.tzOffset, suffix: "" })}.</>}
      {schedule.lastRunAt && <> Last run: {niceTime(Date.parse(schedule.lastRunAt), { offset: schedule.tzOffset, suffix: "" })}, {schedule.lastStatus === "ok" ? "it worked" : schedule.lastStatus === "stopped" ? "it stopped at a step that needs attention" : schedule.lastStatus === "failed" ? "it did not work" : "no answer yet"}.</>}
    </p>
  );

  return (
    <div className="mt-2 border-t border-line px-1 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="Clock" size={16} className="text-mute" />
        <span className="text-sm font-medium">{schedule ? "Scheduled" : "Not scheduled"}</span>
        <Btn size="sm" variant="ghost" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Close" : schedule ? "Change schedule" : "Schedule it"}</Btn>
        {schedule && <Btn size="sm" variant="ghost" loading={pending} onClick={() => run(saveSchedule, send({ enabled: !schedule.enabled }), "Could not change it. Try again.")}>{schedule.enabled ? "Pause" : "Resume"}</Btn>}
      </div>
      {summary}
      {mismatch && (
        <div className="mt-2 flex flex-wrap items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
          <Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" /><span className="min-w-0 flex-1">{mismatch}</span>
          {asked && <Btn size="sm" variant="secondary" loading={pending} onClick={() => run(syncScheduleFromStart, { id: workflowId, tzOffset: -new Date().getTimezoneOffset() }, "Could not use the Start step's time. Try again.")}>Use the Start step{"’"}s time</Btn>}
        </div>
      )}
      {open && (
        <div className="mt-3 rounded-xl border border-line bg-raised p-3">
          {tableMissing ? (
            <p role="alert" className="flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />Scheduling needs one setup step that is not done yet. Open <code className="rounded bg-sunken px-1 py-0.5 text-[13px]">supabase/schedules.sql</code> and run it in Supabase.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">How often
                  <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className={`${field} mt-1 font-normal`}>
                    {Object.entries(FREQUENCIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                {frequency === "hourly" ? (
                  <label className="block text-sm font-medium">Minutes past the hour (0 to 59)
                    <input type="number" min={0} max={59} value={minutePast} onChange={(event) => setMinutePast(event.target.value)} className={`${field} mt-1 font-normal`} />
                  </label>
                ) : (
                  <label className="block text-sm font-medium">At what time (your own time)
                    <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`${field} mt-1 font-normal`} />
                  </label>
                )}
                {frequency === "weekly" && (
                  <label className="block text-sm font-medium">On which day
                    <select value={weekday} onChange={(event) => setWeekday(event.target.value)} className={`${field} mt-1 font-normal`}>
                      {WEEKDAYS.map((name, index) => <option key={name} value={index}>{name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input type="checkbox" checked={allowWrites} onChange={(event) => setAllowWrites(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" />
                <span><span className="font-medium">Let it write by itself.</span> If ticked, a scheduled run may send emails and messages, create tasks and issues, and add rows to your sheet while you are away. If not ticked, those steps are skipped and only the reading steps run.</span>
              </label>
              <p className="mt-2 text-sm text-mute">If a schedule stops working you get one email about it, as long as Gmail (send) is connected on the Connections page.</p>
              {!clockReady && (
                <p className="mt-3 flex items-start gap-2 text-sm text-mute"><Icon name="CircleAlert" className="mt-0.5 shrink-0" />The schedule will be saved, but nothing runs it yet: the clock is not set up. It needs Hushwork to be online (see docs/deploy.md).</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn size="sm" icon="Check" loading={pending} onClick={() => run(saveSchedule, send(), "Could not save the schedule. Try again.", () => setOpen(false))}>Save schedule</Btn>
                {schedule && <Btn size="sm" variant="secondary" icon="Trash" disabled={pending} onClick={() => run(deleteSchedule, { workflowId }, "Could not remove it. Try again.", () => setOpen(false))}>Remove schedule</Btn>}
              </div>
            </>
          )}
          {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
        </div>
      )}
    </div>
  );
}
