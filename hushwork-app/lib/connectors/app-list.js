// THE LIST OF APPS that have a Connect button. To add an app, add ONE entry here (plus its two settings in .env.local).
// Everything else (the sign-in, the saved permission, renewing, Disconnect, the box on the Connections page) is shared and
// reads this list. Nothing in this file is secret: only public web addresses and words for the page.
//
//   id            short lowercase name; it is the saved name in the database, the ?id= in the address and part of the
//                 callback address /api/connect/<id>/callback
//   name          what the button and Disconnect say
//   heading       the title of the box on the Connections page
//   envPrefix     the settings are <envPrefix>_CLIENT_ID and <envPrefix>_CLIENT_SECRET in .env.local
//   authorizeUrl  the app's "Allow" screen    tokenUrl  where the one-time code is swapped    revokeUrl  where permission is cancelled
//   scopes        the permissions asked for (keep them as small as possible: read-only wherever you can)
//   scopeSeparator  what goes between permissions on the Allow address (optional; a space unless the app wants something else)
//   extraAuthorize  extra fields this app wants on the Allow address (optional)
//   about         one short line under the button
export const APP_LIST = [
  {
    id: "linear",
    name: "Linear",
    heading: "Linear",
    envPrefix: "LINEAR",
    authorizeUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    revokeUrl: "https://api.linear.app/oauth/revoke",
    // read: look at tasks. issues:create: add a NEW task (it cannot change or delete anything that already exists).
    scopes: ["read", "issues:create"],
    scopeSeparator: ",", // Linear wants commas between permissions (Google wants spaces)
    extraAuthorize: { prompt: "consent" },
    about: "Reads your open tasks, and adds a new one when you approve it.",
  },
  {
    id: "google",
    name: "Google",
    heading: "Google (Calendar, Sheets, Gmail and Drive)",
    envPrefix: "GOOGLE",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    // calendar.readonly: read calendar events (nothing can be added, changed or deleted).
    // spreadsheets: add a row to a Google Sheet the person names in a step (the sheets connector only ever sends "append one row";
    // Google has no narrower permission that works on an existing sheet).
    // gmail.readonly: read who sent each message, its subject and time (the connector never asks for the body; the permission cannot send, change or delete mail).
    // drive.metadata.readonly: see the names, kinds and times of files (it cannot open, read, change or delete a file).
    scopes: ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"],
    // "offline" + "consent" make Google hand out a refresh token, so the short-lived access token can be renewed without asking again.
    extraAuthorize: { access_type: "offline", prompt: "consent" },
    about: "Reads your calendar, inbox senders and Drive file names, and adds Sheet rows when you approve it.",
  },
];

// Finds one app by its id, or null. Only a real id from the list works (so "__proto__" or a made-up name is just "not found").
export const findApp = (id) => (typeof id === "string" ? APP_LIST.find((app) => app.id === id) ?? null : null);
export const APP_IDS = APP_LIST.map((app) => app.id);
