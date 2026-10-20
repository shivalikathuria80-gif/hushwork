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
//   about         one plain sentence under the button
//   setup         { intro, steps[], note? } how the owner makes Hushwork's own app on the other site, once.
//                 **bold** and `code` are allowed; {callback}, {id} and {secret} are filled in by the page.
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
    about: "Hushwork can read your open Linear tasks, and it can add a new task when a step says so and you approve it. It cannot change or delete anything that already exists. If you connected Linear before task creating was added, press Disconnect and Connect Linear again so Linear asks for the new permission. You press Allow on Linear’s own page, and you can press Disconnect any time.",
    setup: {
      intro: "In Linear open Settings, then **API**, then **OAuth applications**, then **New**.",
      steps: [
        "Name it Hushwork.",
        "As the callback address type `{callback}`.",
        "After saving, copy the **Client ID** and **Client secret** into `.env.local` as `{id}=...` and `{secret}=...`. The secret is private.",
      ],
    },
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
    about: "Google shows you four permissions before you press Allow: reading your calendar events (it cannot change the calendar), adding rows to Google Sheets (a step can only add one row at the bottom of a sheet you name; Hushwork never reads or changes the other cells), reading your Gmail inbox (Hushwork only looks at who sent a message, its subject and its time, never the text inside, and it cannot send, change or delete mail) and seeing the names of your recent Google Drive files (never what is inside them; it cannot open, change or delete a file). If you connected Google before Gmail or Drive was added, press Disconnect and Connect Google again so Google asks for the new permission. You can press Disconnect any time.",
    setup: {
      intro: "Open `console.cloud.google.com` and sign in.",
      steps: [
        "Make a **New project** called Hushwork.",
        "Open **APIs & Services**, then **Library**, and **Enable** four things: **Google Calendar API**, **Google Sheets API**, **Gmail API** and **Google Drive API**.",
        "Open **OAuth consent screen** (it may be called Google Auth platform). Choose **External**, name it Hushwork, add your email, and under **Test users** add your own Google email. Keep it in **Testing**.",
        "Open **Credentials**, then **Create credentials**, then **OAuth client ID**. Type: **Web application**. Under Authorized redirect URIs add `{callback}`.",
        "Copy the **Client ID** and **Client secret** into `.env.local` as `{id}=...` and `{secret}=...`. The secret is private.",
      ],
      note: "Google will warn “Google hasn’t verified this app” because it is your own test app. Press **Advanced**, then **Go to Hushwork**. While the app is in Testing, Google asks you to connect again every 7 days.",
    },
  },
];

// Finds one app by its id, or null. Only a real id from the list works (so "__proto__" or a made-up name is just "not found").
export const findApp = (id) => (typeof id === "string" ? APP_LIST.find((app) => app.id === id) ?? null : null);
export const APP_IDS = APP_LIST.map((app) => app.id);
