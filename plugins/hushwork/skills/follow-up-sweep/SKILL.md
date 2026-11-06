---
name: follow-up-sweep
description: Find email conversations still waiting on a reply (from the person, or from someone they wrote to) and draft follow-ups for them to approve. Use when the person asks "who haven't I replied to", "chase my emails", "follow-ups", or "what's stuck in my inbox".
---

# Follow-up sweep

Find conversations that went quiet and draft short follow-ups. Nothing is sent unless the person approves each one.

## 1. Find the conversations

Use a Gmail search tool if one is available in this conversation (for example the Gmail connector's `search_threads`). Run two searches over the last 14 days unless the person names another window:

- **They owe a reply:** messages in the inbox from real people (not newsletters, receipts or no-reply addresses) where the person has not replied. For example: `in:inbox -category:promotions -category:social -from:me newer_than:14d`, then keep threads whose last message is not from the person.
- **Others owe them a reply:** `from:me in:sent newer_than:14d older_than:3d`, then keep threads where the last message is still the person's own and it asked something or expected an answer.

Read only as much of each thread as you need. Keep at most 8, most important first: a direct question, money, a deadline, or a customer.

If there is no Gmail tool, say so in one line and offer the Hushwork route instead: make an agent (see the make-agent skill) such as "Every weekday at 9, list emails from the last week I haven't replied to and email me the list". Hushwork reads Gmail with the person's own Google connection.

## 2. Draft

For each conversation, draft a follow-up of 2 to 4 sentences in the person's own tone (match their earlier messages in the thread). Don't make up facts, dates or promises. Where something is missing, leave a clear blank like [date].

Show them as a numbered list: who it's to, the subject, why it needs a follow-up (one line), then the draft.

## 3. The person approves

Ask which ones to use: "Which should I save as drafts? (for example 1, 3, 4, all, or none)".

- On their answer, save **only those** as Gmail drafts if a draft tool is available (for example `create_draft`). Drafts are not sent. Tell them the drafts are in Gmail, ready to send.
- Send directly only if the person explicitly says "send" for specific numbers, a send tool is available, and you have just shown the exact text. Otherwise stick to drafts.
- Never send or save anything they didn't pick.

## 4. Offer to keep it going

End with one line: "Want this every week? I can make a Hushwork agent that does the sweep and leaves the drafts for your approval."
