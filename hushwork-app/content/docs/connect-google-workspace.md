# Google Workspace through Composio

Seven Google apps connect through Composio to send email, add events and create new Google files, each with its own Connect button.

## Two Google boxes, not one

The Connections page has two places for Google:

- **Google (Calendar, Sheets, Gmail and Drive)** is the own sign-in. It mostly reads. See [Google](/docs/connect-google).
- **Google Workspace (through Composio)** is a second box. Its apps go through Composio, a separate company that keeps the sign-in. See [More apps through Composio](/docs/connect-other-apps) for what Composio is.

Each app in the Workspace box has its **own Connect button** and its own sign-in. Connecting Google above does not connect any of them, and the other way round. Connect only the ones you need.

## What each one does

| App | Reads | Can do after you Approve |
| --- | --- | --- |
| Gmail (send) | names of your Gmail labels | send one email, or save one email as a draft |
| Google Calendar (events) | names of your calendars | add one event |
| Google Tasks | your tasks | nothing, read only |
| Google Sheets (create) | names of your spreadsheets | create one new spreadsheet filled with rows |
| Google Docs (create) | names of your documents | create one new document with text |
| Google Slides (create) | nothing | create one new presentation with several slides |
| Google Drive (folders) | your name and how much space is used | create one new folder |

None of them can read your emails or open your files. None of them can change or delete anything that already exists.

## Drafts versus sends

Gmail (send) has two actions in the **Do something in another app** step:

- **Send an email (Gmail)** really sends the email as soon as you press Approve.
- **Save an email as a Gmail draft** only puts a draft in your Gmail Drafts. Nothing is sent. You open the draft in Gmail and send it yourself.

For both, write the address in the **Where** box. You can write `{myEmail}` to mean your own address. Hushwork fills it in from your account and shows it on the card. Recipients are only the ones you typed.

## Creating Google files

The new file appears in your Google Drive, and the Runs page shows a link to open it.

- **Sheet:** write rows, one per line, with boxes separated by `|` (or commas). Up to 50 rows and 10 boxes per row. Everything is written as plain text, so a line like `=IMPORTXML(...)` is never run as a formula.
- **Slides:** write an outline. A line starting with `#` begins a new slide, and the lines after it are its bullets. Up to 12 slides and 10 bullets per slide.
- **Doc:** write the text of the document.
- **Drive folder:** leave **Inside folder (id)** empty for the top of your Drive, or write the id of an existing folder (the long code at the end of that folder's address).

The approval card tells you what will be built, for example "5 slides will be made", before you press Approve. If a file is made but its content cannot be added, Hushwork says so, still counts the step as done, and does not make a second file.

## The Workspace box on the Connections page

The box lists the seven apps with a **Connect** button or **Connected** and **Disconnect**. If Composio is not switched on for this copy of Hushwork, the box tells you the one-time setup is needed.

## Reconnecting after new abilities

An app's sign-in is limited to the tools Hushwork needed when you connected. If Hushwork gets a new ability for an app later, press **Disconnect** and then **Connect** for that app once, so the new ability is allowed.

> **Note:** Each of these sign-ins is used only when a step says so and you press Approve (or you chose Auto mode, or ticked **Let it write by itself** on a schedule).

## Related pages

- [Connections overview](/docs/connections)
- [Step types](/docs/step-types)
- [How Hushwork keeps you in control](/docs/safety)
