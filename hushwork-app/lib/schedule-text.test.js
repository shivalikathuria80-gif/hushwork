import test from "node:test";
import assert from "node:assert/strict";
import { parseWhen } from "./schedule-text.js";
import { describeSchedule, checkSchedule } from "./schedule.js";
import { TEMPLATES } from "./templates.js";

const read = (text) => parseWhen(text);

test("schedule text: the ways people write a time are read as a real schedule", () => {
  const cases = [
    ["Every weekday at 17:30", { frequency: "weekdays", hour: 17, minute: 30, weekday: 0 }],
    ["every weekday at 8:30", { frequency: "weekdays", hour: 8, minute: 30, weekday: 0 }],
    ["Weekdays at 9", { frequency: "weekdays", hour: 9, minute: 0, weekday: 0 }],
    ["Every Monday at 9:00", { frequency: "weekly", hour: 9, minute: 0, weekday: 1 }],
    ["Every week on Friday at 16:00", { frequency: "weekly", hour: 16, minute: 0, weekday: 5 }],
    ["mondays at 4pm", { frequency: "weekly", hour: 16, minute: 0, weekday: 1 }],
    ["Every Sunday at 7 am", { frequency: "weekly", hour: 7, minute: 0, weekday: 0 }],
    ["every day at 5:30 pm", { frequency: "daily", hour: 17, minute: 30, weekday: 0 }],
    ["Daily at 09:15", { frequency: "daily", hour: 9, minute: 15, weekday: 0 }],
    ["Every morning at 8", { frequency: "daily", hour: 8, minute: 0, weekday: 0 }],
    ["every day at 12am", { frequency: "daily", hour: 0, minute: 0, weekday: 0 }],
    ["every day at 12pm", { frequency: "daily", hour: 12, minute: 0, weekday: 0 }],
    ["Every hour", { frequency: "hourly", hour: 0, minute: 0, weekday: 0 }],
    ["Hourly", { frequency: "hourly", hour: 0, minute: 0, weekday: 0 }],
    ["Every hour, 43 minutes past", { frequency: "hourly", hour: 0, minute: 43, weekday: 0 }],
    ["Every hour, on the hour", { frequency: "hourly", hour: 0, minute: 0, weekday: 0 }],
    ["  EVERY   MONDAY   AT   9.  ", { frequency: "weekly", hour: 9, minute: 0, weekday: 1 }],
  ];
  for (const [text, expected] of cases) assert.deepEqual(read(text), expected, text);
});

test("schedule text: what cannot be read gives null instead of a guess", () => {
  for (const bad of ["", "   ", "Whenever", "Every Monday", "Every weekday", "every day", "at 9", "Every month on the 1st at 9", "Every Monday at 25:00", "every day at 9:75", "every day at 13pm", "every day at 0am", "x".repeat(200), undefined, null, 5, {}]) assert.equal(read(bad), null, String(bad).slice(0, 30));
});

test("schedule text: the Schedule panel's own words read back as the same schedule, and every template's Start step is readable", () => {
  for (const frequency of ["hourly", "daily", "weekdays", "weekly"]) {
    for (const [hour, minute, weekday] of [[0, 0, 0], [9, 0, 1], [17, 30, 5], [23, 59, 6]]) {
      const s = checkSchedule({ frequency, hour, minute, weekday, tzOffset: 0 }).value;
      const text = describeSchedule(s);
      const back = read(text);
      assert.ok(back, text);
      assert.equal(back.frequency, s.frequency, text);
      assert.equal(back.minute, s.minute, text);
      if (frequency !== "hourly") assert.equal(back.hour, s.hour, text);
      if (frequency === "weekly") assert.equal(back.weekday, s.weekday, text);
    }
  }
  for (const t of TEMPLATES.filter((x) => x.steps[0].kind === "trigger" && x.steps[0].fields.how === "schedule")) assert.ok(read(t.steps[0].fields.when), `${t.id}: "${t.steps[0].fields.when}" can be read`);
});
