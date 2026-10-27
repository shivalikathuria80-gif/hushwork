// THE PAUSE SWITCH. One row in the table app_controls (supabase/app-controls.sql) named "paused". While it is true, Hushwork does nothing on anyone's behalf:
// no step that WRITES (send, create, add) starts, no Ask the AI step is asked, and the clock starts no scheduled run. Looking at pages, reading runs and
// pressing Disconnect or Delete still work. Only the owner can flip it (in the Supabase SQL Editor: update public.app_controls set value = true where name = 'paused';),
// so there is no button a visitor could press, and no new deploy is needed to stop everything.
// A missing table (not set up yet) or an unreadable answer means "not paused": the switch must never be the reason the app breaks.
export const PAUSED_MESSAGE = "Hushwork is paused right now as a safety step, so nothing was sent and the AI was not asked. Nothing is lost. Try again later.";

export async function isPaused(supabase) {
  try {
    const { data, error } = await supabase.from("app_controls").select("value").eq("name", "paused").limit(1);
    if (error || !Array.isArray(data)) return false;
    return data[0]?.value === true;
  } catch {
    return false;
  }
}
