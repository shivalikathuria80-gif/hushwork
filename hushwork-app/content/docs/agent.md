# Your Hushwork Agent

The agent is the part of Hushwork that is always working. You turn it on once, and it keeps looking at your apps for you.

## What it does

Three times a day, at 9:00, 13:00 and 17:00 your time, the agent looks at the apps you connected:

- your Google Calendar for the next 7 days
- who emailed you and about what (the sender and subject of your newest emails, never the text)
- your open Linear tasks
- up to 3 apps connected through Composio, such as Stripe invoices, GitHub or Todoist

Then it picks the few things that need you soon: a meeting to prepare for, an email that looks like it needs an answer, an unpaid invoice, a task that looks stuck. You see at most 3 notes at the top of your workspace. Each note says what needs you, why, and a ready next step.

## Turn it on

1. Open your workspace (the first page after you sign in).
2. In the **Your Hushwork Agent** card, press **Turn on the agent**.
3. It takes its first look right away.

To stop it, press **Turn off** in the same card. **Look now** takes an extra look outside the three set times.

## Do this and Dismiss

- **Do this** puts the note's next step into the box on your workspace. You get a plan, and every step that sends or creates something still waits for your Approve.
- **Dismiss** hides the note. The agent remembers it was shown, so it does not bring the same note back unless something changed.

## What it will never do

- It only reads. It never sends, creates or changes anything in your apps by itself.
- It emails you only when it finds something new: at most 3 times a day, and never at night. The email only says to open your workspace. It never repeats what was found.
- When Hushwork is paused, the agent does not look.

## What it costs

Each look uses one of your 15 AI steps a day, so the three daily looks use 3. **Look now** uses one more each time. When the AI steps for the day are used up, the agent waits until the next day.

## What the AI sees

The calendar events, email senders and subjects, task titles and app lists described above go to the AI (Groq) for each look. The text inside your emails is never read by the agent. Your saved Memory facts are added, as information only. See [Privacy and what the AI sees](/docs/privacy).

## If it says something is missing

- **"There is nothing to look at yet"**: connect Google, Linear or another app on the Connections page.
- **"The agent needs one setup step"**: the owner of this Hushwork has not created the agent's table yet (`supabase/agent.sql`).
