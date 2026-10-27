// The little logo ("thumbnail") shown for each connection. Two sources, no pictures downloaded from anywhere (so nothing is requested from
// outside while the page loads):
//   ARTWORK  full-colour logos drawn here as small SVG shapes, for the brands whose real logo has several colours (the four Google products
//            and Slack). A one-colour silhouette would not look like them.
//   LOGOS    one-colour logos with the brand's colour, from the `simple-icons` package (GitHub, Stripe, Linear, ...).
// The logos only identify which app a box is about; the brands belong to their owners.
//
// To give a new app a logo: add a line to LOGOS (or draw one in ARTWORK). An id with neither gets a plain icon from components/icons.js
// (see `fallbackIcon`), so a missing logo never breaks a page.
import {
  siAirtable, siCloudflare, siGithub, siGoogle, siGoogletasks, siHubspot, siJira, siLinear,
  siMailchimp, siModelcontextprotocol, siNotion, siPagerduty, siSentry, siStripe, siTodoist, siTrello, siVercel, siXero,
} from "simple-icons";

// A drawn logo: a viewBox and a list of shapes. A shape is { d, fill } (a path), { rect: [x, y, width, height, radius], fill, stroke } or
// { text, x, y, size, fill } (a few big digits; drawn with the browser's own bold font).
export const ARTWORK = {
  // Gmail: a white envelope with its red "M" and the blue and green side flaps
  gmail: {
    title: "Gmail", viewBox: "0 0 24 24",
    shapes: [
      { rect: [2, 4.5, 20, 15, 2], fill: "#ffffff", stroke: "#dadce0" },
      { d: "M2 7.5v10a2 2 0 0 0 2 2h2.4V10.2L2 7.5z", fill: "#4285F4" },
      { d: "M22 7.5v10a2 2 0 0 1-2 2h-2.4V10.2L22 7.5z", fill: "#34A853" },
      { d: "M17.6 5.9 22 7.5v-.9a2 2 0 0 0-2-2.1h-.2z", fill: "#FBBC04" },
      { d: "M2 6.6a2 2 0 0 1 2-2.1h.2L12 10.3l7.8-5.8H20a2 2 0 0 1 2 2.1L12 14 2 6.6z", fill: "#EA4335" },
      { d: "M4.2 4.5 6.4 6.1V10.2L2 7.5v-.9A2 2 0 0 1 4 4.5z", fill: "#C5221F" },
    ],
  },
  // Google Drive: the three-coloured triangle
  drive: {
    title: "Google Drive", viewBox: "0 0 87.3 78",
    shapes: [
      { d: "m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z", fill: "#0066da" },
      { d: "m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z", fill: "#00ac47" },
      { d: "m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z", fill: "#ea4335" },
      { d: "m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z", fill: "#00832d" },
      { d: "m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z", fill: "#2684fc" },
      { d: "m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z", fill: "#ffba00" },
    ],
  },
  // Google Calendar: a white page with a blue top, a coloured corner and the day number
  calendar: {
    title: "Google Calendar", viewBox: "0 0 24 24",
    shapes: [
      { rect: [3, 3, 18, 18, 2.2], fill: "#ffffff", stroke: "#dadce0" },
      { d: "M3 5.2A2.2 2.2 0 0 1 5.2 3h13.6A2.2 2.2 0 0 1 21 5.2V8H3z", fill: "#4285F4" },
      { d: "M21 16.5V18.8A2.2 2.2 0 0 1 18.8 21H16.5z", fill: "#EA4335" },
      { d: "M3 18.8V16.5L7.5 21H5.2A2.2 2.2 0 0 1 3 18.8z", fill: "#34A853" },
      { d: "M16.5 21 21 16.5V21z", fill: "#FBBC04" },
      { text: "31", x: 12, y: 17, size: 8.4, fill: "#4285F4" },
    ],
  },
  // Google Sheets: a green page with a folded corner and a white grid
  sheets: {
    title: "Google Sheets", viewBox: "0 0 24 24",
    shapes: [
      { d: "M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", fill: "#0F9D58" },
      { d: "M14 2l5 5h-4a1 1 0 0 1-1-1z", fill: "#87CEAC" },
      { rect: [7.2, 11, 9.6, 7.6, 0.6], fill: "#ffffff" },
      { d: "M7.2 13.5h9.6M7.2 16.05h9.6M11.6 11v7.6", fill: "none", stroke: "#0F9D58" },
    ],
  },
  // Slack: four coloured pill shapes
  slack: {
    title: "Slack", viewBox: "0 0 122.8 122.8",
    shapes: [
      { d: "M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z", fill: "#E01E5A" },
      { d: "M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z", fill: "#36C5F0" },
      { d: "M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z", fill: "#2EB67D" },
      { d: "M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z", fill: "#ECB22E" },
    ],
  },
};

ARTWORK.gcalwrite = ARTWORK.calendar; // the Calendar picture, for the event-adding connection through Composio
ARTWORK.gmailsend = ARTWORK.gmail; // the same picture, for the send-only Gmail connection through Composio
ARTWORK.gsheets = ARTWORK.sheets; // the Sheets and Drive pictures, for the Google files made through Composio
ARTWORK.gdrivewrite = ARTWORK.drive;
// Google Docs: a blue page with a folded corner and white text lines
ARTWORK.gdocs = {
  title: "Google Docs", viewBox: "0 0 24 24",
  shapes: [
    { d: "M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", fill: "#4285F4" },
    { d: "M14 2l5 5h-4a1 1 0 0 1-1-1z", fill: "#A1C2FA" },
    { d: "M7.5 11.5h9M7.5 14.5h9M7.5 17.5h6", fill: "none", stroke: "#ffffff" },
  ],
};
// Google Slides: a yellow page with a folded corner and a white slide
ARTWORK.gslides = {
  title: "Google Slides", viewBox: "0 0 24 24",
  shapes: [
    { d: "M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", fill: "#F4B400" },
    { d: "M14 2l5 5h-4a1 1 0 0 1-1-1z", fill: "#FCE8B2" },
    { rect: [7.2, 11, 9.6, 6.6, 0.8], fill: "#ffffff" },
  ],
};

export const LOGOS = {
  linear: siLinear,
  google: siGoogle,
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

// What shows when an id has neither: a name from components/icons.js.
export const FALLBACK_ICONS = { web: "Plug" };

// The logo for an id, or null. Only listed ids count ("__proto__" or a made-up name is just "no logo").
export const logoFor = (id) => (typeof id === "string" && Object.hasOwn(LOGOS, id) ? LOGOS[id] : null);
export const artFor = (id) => (typeof id === "string" && Object.hasOwn(ARTWORK, id) ? ARTWORK[id] : null);
export const hasLogo = (id) => Boolean(artFor(id) || logoFor(id));
export const fallbackIcon = (id) => (typeof id === "string" && Object.hasOwn(FALLBACK_ICONS, id) ? FALLBACK_ICONS[id] : "Plug");
