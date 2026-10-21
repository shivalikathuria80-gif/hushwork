// The little logo ("thumbnail") shown for each connection. The shapes and brand colours come from the `simple-icons` package (one SVG path
// per brand, no pictures downloaded from anywhere, so nothing is requested from outside while the page loads). The logos only identify
// which app a box is about; the brands belong to their owners.
//
// To give a new app a logo: add a line below under the app's id. An id with no line (or no logo in the package) gets a plain icon from
// components/icons.js instead (see `fallbackIcon`), so a missing logo never breaks a page.
import {
  siAirtable, siCloudflare, siGithub, siGmail, siGoogle, siGooglecalendar, siGoogledrive, siGooglesheets, siGoogletasks, siHubspot, siJira, siLinear,
  siMailchimp, siModelcontextprotocol, siNotion, siPagerduty, siSentry, siStripe, siTodoist, siTrello, siVercel, siXero,
} from "simple-icons";

export const LOGOS = {
  linear: siLinear,
  google: siGoogle,
  gmail: siGmail,
  drive: siGoogledrive,
  calendar: siGooglecalendar,
  sheets: siGooglesheets,
  notion: siNotion,
  todoist: siTodoist,
  airtable: siAirtable,
  hubspot: siHubspot,
  jira: siJira,
  github: siGithub,
  vercel: siVercel,
  sentry: siSentry,
  cloudflare: siCloudflare,
  pagerduty: siPagerduty,
  stripe: siStripe,
  xero: siXero,
  mailchimp: siMailchimp,
  googletasks: siGoogletasks,
  trello: siTrello,
  mcp: siModelcontextprotocol,
};

// What shows when an id has no logo: a name from components/icons.js.
export const FALLBACK_ICONS = { web: "Plug", slack: "MessageSquare" };

// The logo for an id, or null. Only listed ids count ("__proto__" or a made-up name is just "no logo").
export const logoFor = (id) => (typeof id === "string" && Object.hasOwn(LOGOS, id) ? LOGOS[id] : null);
export const fallbackIcon = (id) => (typeof id === "string" && Object.hasOwn(FALLBACK_ICONS, id) ? FALLBACK_ICONS[id] : "Plug");
