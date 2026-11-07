// Minutes in words, for "Your week". Its own small file so the browser code (components/app/WeekFx.js) does not pull in the run engine.
// "1 h 25 min", "40 min", "0 min".
export function minutesText(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
