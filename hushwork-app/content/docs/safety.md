# How Hushwork keeps you in control

Nothing is sent, created or added until you read the exact words and press Approve, and Hushwork checks this on its server.

## The approval promise

A step that sends or creates something shows an approval card first. The card lists exactly what will be sent and where it goes. In Manual mode (the default) nothing happens until you press the Approve button on the Runs page.

The check is not only a button on the screen. When you press Approve, Hushwork's server loads the saved run from the database (it never trusts what the browser says the step is) and checks the step's words again. For emails, messages, tasks, web addresses and AI requests it refuses text that looks like a card number or a secret key. It checks your limits (see [Limits and numbers](/docs/limits)), saves a small "started" record, does that one thing, then saves "done" or "failed".

A writing step can be approved once per run. Pressing the button twice never sends two copies.

## The exact-words check

When you press Approve, the browser hands back the exact words of the card you read. If the words the step would send now are different (for example an Ask the AI step ran again in another tab), nothing is sent. Hushwork tells you to reload, read the new words and press Approve again.

## Practice runs and real runs

A **practice run** only writes down what each step would do. Nothing leaves Hushwork. A **real** action starts only when you press Approve on a step, or in the two cases below.

> **Careful:** Auto mode does every real step straight away, in order, without asking. A schedule with **Let it write by itself** ticked does the same while you are away. Both are choices you make on purpose. Auto mode stops at the first step that fails and does at most 20 steps. A schedule that does not have the box ticked skips every step that writes.

A **Keep watching** workflow never writes by itself unless you ticked that box. Its writing steps wait for your Approve click.

## When Hushwork is not sure

If the connection drops or the app is busy, Hushwork cannot tell whether a writing step went through. It marks the step **Not sure if this happened** and does not send it again by itself. You look in the app. If it did not happen, press **It was not done, try again**. A step that is clearly done is never done again. If Hushwork cannot save the "started" record, nothing is sent. **Continue from where it stopped** is safe to press twice.

## The pause switch

The owner can flip one switch in the database. While it is on, no writing step starts, no Ask the AI step is asked, and no scheduled run starts. Pages still open, and Disconnect and Delete still work. There is no button for visitors.

## Web addresses are checked

A **Call a web address** step only works with https addresses of public websites. Hushwork refuses private or internal places, numeric addresses, `localhost`, and addresses with a password or a port. It does not follow redirects, stops after 8 seconds, reads at most 64 KB and sends no cookies or secrets.

## MCP tools are read only

MCP is a standard way for a company to offer tools to an AI. In an **MCP server** step you paste one https address. Hushwork connects through the same careful web check and only lets the AI use tools the server marks read only, or tools whose names are plain reading words and contain no writing word. At most 8 tools are offered. A server that asks for a login is refused. Your saved Memory facts are not given to the AI in that step.

## What never happens

- Hushwork never asks for your password for another app. You sign in on that app's own page.
- It never deletes anything in your apps, and it never changes something that already exists.
- The AI can only read. It cannot send, create or delete anything.
- Built-in AI tools take no input from the AI, so the AI cannot pick a web address, a task or a file.
- Text from emails, web pages and apps reaches the AI wrapped as information, with a note to ignore any orders inside it.
- Email goes only to addresses you typed or to your own account. It is never taken from what an email or a page says.
- Hushwork never moves money.

> **Note:** No software can protect someone who presses Approve without reading. Read the card.

## Related pages

- [Connections overview](/docs/connections)
- [Privacy and what the AI sees](/docs/privacy)
- [Troubleshooting and FAQ](/docs/troubleshooting)
