"use client";

import { useSyncExternalStore } from "react";

// A saved time shown in the visitor's own time zone. The server answers with an empty string, the browser with the
// real time, so there is no mismatch (same trick as DraftCard).
const format = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const subscribeToNothing = () => () => {};

export default function RunTime({ iso }) {
  const text = useSyncExternalStore(
    subscribeToNothing,
    () => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? "" : format.format(date); },
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}
