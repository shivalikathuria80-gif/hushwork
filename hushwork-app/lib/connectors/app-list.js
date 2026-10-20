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
    scopes: ["read"], // read only: Hushwork never asks to change anything in Linear
    extraAuthorize: { prompt: "consent" },
    about: "Hushwork can read your open Linear tasks. It can only look. It cannot change anything in Linear. You press Allow on Linear’s own page, and you can press Disconnect any time.",
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
    heading: "Google (Calendar and Sheets)",
    envPrefix: "GOOGLE",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    // calendar.readonly: read calendar events (nothing can be added, changed or deleted).
    // spreadsheets: add a row to a Google Sheet the person names in a step (the sheets connector only ever sends "append one row";
    // Google has no narrower permission that works on an existing sheet).
    scopes: ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/spreadsheets"],
    // "offline" + "consent" make Google hand out a refresh token, so the short-lived access token can be renewed without asking again.
    extraAuthorize: { access_type: "offline", prompt: "consent" },
    about: "Google shows you two permissions before you press Allow: reading your calendar events (it cannot change the calendar) and adding rows to Google Sheets (a step can only add one row at the bottom of a sheet you name; Hushwork never reads or changes the other cells). You can press Disconnect any time.",
    setup: {
      intro: "Open `console.cloud.google.com` and sign in.",
      steps: [
        "Make a **New project** called Hushwork.",
        "Open **APIs & Services**, then **Library**, and **Enable** two things: **Google Calendar API** and **Google Sheets API**.",
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
