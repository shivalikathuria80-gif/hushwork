# Google review checklist (OAuth verification)

> Written 2026-10-28. Google changes these rules often: **read Google's current "OAuth app verification" pages before you rely on anything here.** This is a checklist, not legal advice. Only the owner can submit the review.

Up: [Docs index](INDEX.md) · [Launch checklist](launch.md)

## Where we are

The Hushwork Google app is in **Testing** mode. Only people added as test users can connect Google, they see an "unverified app" warning, and their Google connection stops after about 7 days (they must reconnect). Scheduled runs that use Gmail, Drive, Calendar or Sheets break on the same 7-day clock. Strangers cannot connect until Google approves the app.

## What Hushwork asks for today

Set in `hushwork-app/lib/connectors/app-list.js` (the Google entry). Google's own sensitivity labels, to be re-checked on Google's scope list:

| Permission | What Hushwork uses it for | Google label |
|---|---|---|
| `calendar.readonly` | Read your events for plans like a morning brief | Sensitive |
| `spreadsheets` | Read and write the sheets a workflow uses | Sensitive |
| `gmail.readonly` | Read the newest emails for Reply Drafts and Invoice Chaser | **Restricted** |
| `drive.metadata.readonly` | List recent file names and folders for the Drive tidy-up plan | **Restricted** |

Sensitive permissions need a normal review. Restricted ones need that plus, usually, a yearly security assessment by an outside company, which can be slow and cost money. Gmail *sending*, and Google Docs, Slides and Drive creation, go through Composio and are a separate path.

## The choice to make first

1. **Ask for all four and pass the restricted review.** Slowest and costliest. Needed only if Hushwork must read Gmail and Drive itself.
2. **Ask for only the two sensitive ones** (Calendar, Sheets) and move Gmail and Drive reading to Composio. Much simpler review. Costs a code change; ask Claude before deciding.
3. **Stay on Testing for the pilot** and apply later. The 5 to 10 test users in [launch.md](launch.md) work today, with the weekly reconnect.

## What Google asks for

- [ ] A real domain you own (`hushwork.in`) added to Google Search Console and verified, and set as an authorised domain on the consent screen.
- [ ] A public home page on that domain that says what the app does and links to the privacy page.
- [ ] A public **privacy policy** page (`/privacy` exists) that says exactly what Google data is read, why, where it is stored, and that it is not sold or used to train AI. Needs a real contact address (see launch.md, "Law").
- [ ] The **terms** page (`/terms` exists).
- [ ] A consent screen with the app name, logo, support email and developer email filled in.
- [ ] For each permission, a short written reason, in plain words: what the feature is, and why a smaller permission would not do.
- [ ] A **demo video** (screen recording, unlisted on YouTube) showing: the sign-in, Google's permission screen with the app name and web address visible, and each permission being used in the app.
- [ ] The redirect addresses on the new domain registered in the Google app (see `docs/deploy.md` section 13).
- [ ] Proof the app follows Google's "limited use" rule: Google data is used only for the feature the person asked for.
- [ ] If restricted permissions stay: book the security assessment Google names, and budget for it.

## Order

1. Attach `hushwork.in` and `docs.hushwork.in` in Vercel (launch.md, "The domain").
2. Decide option 1, 2 or 3 above.
3. Fill the consent screen, verify the domain, record the demo video.
4. Submit. Reply to Google's emails quickly; reviews often take several rounds.
5. Launch to everyone only after Google says "verified".

## Where in the code

- `hushwork-app/lib/connectors/app-list.js`: the Google permissions.
- `hushwork-app/app/privacy/page.js`, `hushwork-app/app/terms/page.js`: the pages Google will read.
- `hushwork-app/content/docs/connect-google.md`: what users are told about the test-user warning.
