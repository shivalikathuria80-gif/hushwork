# Limits and numbers

The limits that keep Hushwork safe, fair and affordable: how many times a day, how long text can be, and how many things you can keep.

## How the limits work

Limits are per person. Daily limits reset at midnight UTC, not midnight where you live. When you hit one, Hushwork tells you. For example: "You did that a moment ago. Try again in a minute." or "You have reached today's limit for AI steps. It resets at midnight UTC."

The counts for AI use, sent actions, Linear tasks and sheet rows live in the database. The others live in the server's memory, so they can start again if the server restarts.

## Daily and per-minute limits

| What | Per minute | Per day |
| --- | --- | --- |
| AI plans (the arrow in the task box) | 2 | 20 |
| AI plans for everybody together | 3 | 60 |
| Ask the AI steps (lookup summaries share this allowance) | 3 | 15 |
| Lookups (Linear, Calendar, Gmail, Drive, apps), each kind counted on its own | 5 | 30 |
| Web calls | 5 | 30 |
| Sent actions (Do something in another app) | 3 | 15 |
| Created Linear tasks | 3 | 15 |
| Added Google Sheet rows | 5 | 30 |
| Test all my connections | 4 every 5 minutes | none |

Sign-in: 8 tries per email every 10 minutes. Creating an account: 3 tries per email an hour.

## Watch mode and quiet hours

| What | Number |
| --- | --- |
| Speak-ups (emails telling you something is new) | 3 per day, counted in your own local day |
| Quiet hours | no speak-ups from 20:00 until 08:00, your own time |

A watch check that comes due during quiet hours is skipped and moves on to its next time. See [Watch mode](/docs/watch-mode).

## Things you can have

| What | Number |
| --- | --- |
| Steps in one plan | 12 |
| Schedules | 10 per person, one per workflow |
| Memory facts | 50 |
| Skill bundles turned on | 20 |
| Email addresses added at once with Email several people | 8 |
| Steps done by Auto mode in one run | 20 |
| Runs in Download my data | your 500 newest |

## Text lengths

| Where | Longest |
| --- | --- |
| Task you type in the box | 2000 characters |
| Workflow name | 80 characters |
| Title or detail of a plain note step | 200 characters each |
| Whole plan | about 19,000 bytes in total |
| Ask the AI: what should the AI do | 110 characters |
| Ask the AI: web address | 100 characters |
| Call a web address | 120 characters |
| Add a row: sheet address / what to add | 120 / 80 characters |
| Create Linear task: title / details / team key | 100 / 150 / 10 characters |
| Do something in another app: where / title / more details | 40 / 80 / 120 characters |
| Memory fact: group / name / fact | 40 / 60 / 300 characters |
| Password | 10 to 64 characters |
| Email address | 254 characters |

## What gets filled in

- `{answer}` is cut to 500 characters on one line. In an email, a Doc, a Sheet, a Slides outline or a Notion page it keeps line breaks and can be up to about 3000 characters.
- An Add a row row has up to 20 boxes of up to 100 characters.
- A new Sheet has up to 50 rows of up to 10 boxes, each box up to 200 characters.
- A new presentation has up to 12 slides with up to 10 bullets each.
- A created Linear task can have a title up to 200 characters and details up to 1500.

## How much the AI looks at

| What | Amount |
| --- | --- |
| Linear tasks | up to 10 |
| Calendar events | up to 10, in the next 7 days |
| Gmail inbox | latest 10 messages (sender, subject, time) |
| Gmail with text | 5 newest emails, about 450 characters each |
| Drive files | 10 most recent (name, kind, time) |
| Slack channel | latest 10 messages |
| MCP server | at most 8 read-only tools, each answer cut to 3000 characters |
| Web page | about 1500 characters from the start of the page |
| An AI answer | about 3500 characters |

A web call waits at most 8 seconds and reads at most 64 KB.

## Memory sent to the AI

At most 20 facts and about 2000 characters are sent with each AI request.

## Related pages

- [Ask the AI and earlier answers](/docs/ai-writing)
- [Troubleshooting and FAQ](/docs/troubleshooting)
- [Schedules](/docs/schedules)
