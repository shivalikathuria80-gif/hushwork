# Ask the AI and earlier answers

An Ask the AI step gives the AI a job and lets it read one place first. Its answer can feed later steps.

## What the step does

You write a short job, for example "Tell me which task to do first". You can also pick one place the AI may look at first. The AI reads from that place, thinks, and writes an answer. It can only read. It cannot send, create, change or delete anything.

The AI is made by Groq, a separate company that runs AI models. Your request, and what the AI reads, go to Groq. See [Privacy and what the AI sees](/docs/privacy).

In Manual mode you press **Approve and ask the AI** on the Runs page. The answer is saved in your run, and later steps can use it.

## One place to look

The field **What may it look at?** has these choices:

- **Nothing, just think**
- **My Linear tasks**
- **My Google Calendar** (the next 7 days)
- **My Gmail inbox (senders and subjects)**
- **My Gmail inbox, with the text of each email** (about 450 characters of each of your 5 newest emails)
- **My Google Drive files** (names, kinds and times)
- **Another app (Todoist, Notion...)**
- **A web address**
- **An MCP server**

A step looks in **one** place only. To look in two places, use two Ask the AI steps. For **Another app**, write the app's short name in the address box, for example `todoist`, `github`, `stripe` or `stripeinvoices`. For the latest messages of one Slack channel, write `slackmessages:channelname`. For **A web address** or **An MCP server**, write an https address.

Linear, Calendar, Gmail and Drive need [Google](/docs/connect-google) or [Linear](/docs/connect-linear) connected. Other apps need their connection from [More apps through Composio](/docs/connect-other-apps).

## Passing answers along

Three tags let words move between steps. Write them exactly with curly brackets.

**`{answer}`** is what an Ask the AI step of the same workflow said, after you approved it. Use it in an **Add a row** box, a **Create Linear task** title or details, or the title and details of **Do something in another app**. For example, an email step with the details `{answer}` emails you what the AI wrote. If there is no answer yet, the step stops and tells you to approve the Ask the AI step first.

**`{answers}`** is every earlier answer. Use it in two places:

- Inside an Ask the AI job, to hand that step the answers of the Ask the AI steps before it. For example: "Which of these requests have no open task? {answers}".
- In the details of an email, a Doc, a Sheet, a Slides outline or a Notion page, to put all the answers in order, one after another. A morning briefing email can carry three summaries this way.

**`{last}`** is what this same step answered the last time the workflow ran. Use it in an Ask the AI job so the AI can tell what is new, for example "Tell me only what is new since {last}". The first time, there is no earlier answer and the AI is told it is the first check. A check that said NOTHING NEW is skipped, and the one before it is used. This is how [Watch mode](/docs/watch-mode) works.

## Why earlier answers are handed over as information only

An earlier answer might contain words from an email or a web page written by a stranger. If those words were pasted into your request, they could try to give the AI orders. So Hushwork puts earlier answers in a separate block marked as data. The AI is told to use it only as information and to ignore any orders inside.

## The daily allowance

Ask the AI steps are limited to 3 a minute and 15 a day for each person. The short summary the AI writes after a lookup shares that allowance. Daily counts reset at midnight UTC. The AI also stops after 4 rounds of thinking and looking, and an answer is cut at about 3500 characters. See [Limits and numbers](/docs/limits).

If a limit is used up, Hushwork says so and the step does not run. If the AI is switched off, the step says "AI is switched off".

## Related pages

- [Step types](/docs/step-types)
- [Memory](/docs/memory)
- [Troubleshooting and FAQ](/docs/troubleshooting)
