# The workspace: describe a chore

The Workspace is the home page of the app: you type a chore, see a plan, and save it as a draft.

## The box

At the top you see the question "What should Hushwork take off your plate?" and a big text box. Type a chore the way you would say it. For example: "Every Monday, remind clients with unpaid invoices."

- You can write up to **2000 characters**.
- Press the round **arrow** button (named "Preview plan") or press **Enter** to make a plan. Press **Shift and Enter** for a new line.
- Do not type passwords or card numbers. If your text looks like a card number or a secret key, Hushwork does not send it to the AI and shows a keyword preview instead.

## Example sentences

Under the empty box, the heading says "Not sure what to type? Tap one, then press the arrow." There are three examples. Each says which apps it needs:

- Every Friday, find my unpaid Stripe invoices and email me a reminder to review (needs Stripe and Gmail (send))
- Every weekday morning, list today's meetings and email me a prep card (needs Google and Gmail (send))
- Every Monday, think of five post ideas and email them to me (needs Gmail (send))

Tapping one fills the box. It does not run anything.

## The "Write with AI" switch

Under the box is a switch called **Write with AI**. It only shows when AI planning is available.

- **On** (the default): your text is sent to Groq, the company that runs the AI, to write the plan. A line under the box says so.
- **Off**: Hushwork makes a **keyword preview** in your browser. It matches words in your text. Your text is not sent anywhere.

The switch remembers its position in this browser.

## The plan preview

After you preview, a card shows your steps. Its heading tells you where the plan came from, for example "Plan written by AI. Nothing will be sent." or "Keyword preview. Nothing will be sent." The AI can make mistakes, so read each step.

Buttons on the card:

- **Save as draft** saves the plan.
- **Open in the Builder** saves it and opens the Builder. See [The Builder and its blocks](/docs/builder).
- **Edit steps** changes the steps by hand.
- **Edit request** changes the words in the box.
- **Start over** clears it.

If the AI is slow, press **Show keyword preview instead**. If it fails, you see a keyword preview and a short reason.

## Drafts and templates

Below the box is **Your drafts**, the plans you saved. Open one to work on it. Under the box you also see **Or start from one that works**, a row of templates. **See all templates** opens the Templates page. See [Templates](/docs/templates).

## The daily AI limit

You get **20 AI plans a day** and 2 a minute. A line under the box shows "N of 20 AI plans left today". The count resets at **midnight UTC** (Coordinated Universal Time, the world's reference clock). When you use them all, the switch is greyed out for the day and the keyword preview still works.

AI steps inside a run have their own, smaller allowance. See [Limits and numbers](/docs/limits).

## Try it

1. Tap the first example sentence.
2. Press the arrow.
3. Read the plan and each step.
4. Press **Open in the Builder**.
