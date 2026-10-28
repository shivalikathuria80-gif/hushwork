# Step types

Every block the Builder offers, what it does, what it needs, whether it reads or writes, and whether it waits for your Approve.

## How to read this page

A workflow is a list of steps. Each step comes from a block on the left side of the **Builder**. In Manual mode, a step that does something real shows an **Approve** button on the Runs page. A **practice run** only writes down what each step would do.

## The blocks

| Block | What it does | Needs | Reads or writes | Waits for Approve |
| --- | --- | --- | --- | --- |
| Start | Says what starts the workflow | nothing | neither | no |
| Linear | Looks at your open Linear tasks | Linear | reads | yes |
| Web address | Asks one https address for information (a read-only GET) | nothing | reads | yes |
| Ask the AI | Gives the AI a job, optionally with one place to look | Groq (the AI) and the app it looks in | reads | yes |
| MCP server | Lets the AI use the read-only tools of one server | nothing | reads | yes |
| Ask me first | A marker where the writing starts | nothing | neither | see below |
| Add a row | Adds one row to a Google Sheet you name | Google | writes | yes |
| Create Linear task | Adds one new task in Linear | Linear | writes | yes |
| Another app | Looks at one fixed thing in an app you connected through Composio | that app | reads | yes |
| Do in another app | Really sends or creates one thing in an app | that app, through Composio | writes | yes |
| Note | Your own words | nothing | neither | no |

## Notes on the blocks

**Start.** Choose what starts it: **On a schedule**, **Keep watching: tell me only when something new shows up**, **When an email arrives**, **When a new lead arrives**, or **When I ask**. Only **On a schedule** and **Keep watching** make a real schedule when you press Save. Write the time like you would say it, for example "Every weekday at 17:30". See [Schedules](/docs/schedules) and [Watch mode](/docs/watch-mode). The other choices are labels: Hushwork does not watch your inbox for you.

**Ask the AI.** The fully explained step. See [Ask the AI and earlier answers](/docs/ai-writing).

**Ask me first.** This step is a note to yourself about where the writing begins. The real stop is the Approve button on each writing step. The Skills list adds one automatically before a skill that writes.

**Add a row.** You paste the web address of your Google Sheet and write the boxes, separated by commas, for example `Ana, 500, 20 Oct`. You can write `{answer}` to use what an Ask the AI step said.

**Another app.** Pick the app, for example Todoist or Notion, and add an optional note. Apps whose lookup needs something typed, like one Slack channel, are used inside an Ask the AI step instead.

**Do in another app.** Choose one action:

- Send an email (Gmail), or save an email as a Gmail draft (nothing is sent).
- Send a Slack message.
- Create a GitHub issue.
- Add a Todoist task.
- Add a Google Calendar event (write the start as `2026-11-05 15:00`).
- Create a Notion page.
- Create a Google Sheet, a Slides presentation or a Doc.
- Create a Google Drive folder.

You fill in **Where**, **Message or title** and **More details**. The card shows the exact words and where they go. The step can be approved once per run. See [Google Workspace through Composio](/docs/connect-google-workspace) and [More apps through Composio](/docs/connect-other-apps).

## Steps that only describe

Older plans may hold steps named **Look something up**, **Draft something** and **Send a message**. They are not offered in the Builder any more. They only describe what would happen, and the Runs page marks them **Plan only**. They never do anything when run. To really send, create or add something, use **Do in another app**.

One exception: an old **Send a message** step set to email with a real address (or "me") is treated as a real email. You still read the card and press Approve.

When you save, the Builder says "Heads up" if a step only describes.

## Auto mode and schedules

Auto mode runs the real steps straight away, in order, without asking. A schedule only runs steps that write if you ticked **Let it write by itself**. Both are your choice. See [Runs and approvals](/docs/runs-and-approvals).

## Related pages

- [Builder](/docs/builder)
- [Connections overview](/docs/connections)
- [How Hushwork keeps you in control](/docs/safety)
