# Try everything Hushwork can do (in plain words)

Hushwork runs on your computer at `http://localhost:3100`. Nothing real happens until **you press an Approve button**.

## 0. Make it start

Open the terminal in the `hushwork-app` folder and run `npm run dev`. This starts the app. Then open `http://localhost:3100` in Chrome and sign in.

## 1. One-time setup for Google (Gmail and Drive are new)

1. Go to `console.cloud.google.com` and open your Hushwork project.
2. Open **APIs & Services**, then **Library**. Make sure these four are **Enabled**: Google Calendar API, Google Sheets API, Gmail API, Google Drive API.
3. In Hushwork open **Connections**. Under Google press **Disconnect**, then **Connect Google**, and press **Allow** on every permission. Do the same for **Linear** (it now has a new permission: adding a task).

## 2. Easy things to try (they only read)

Open **Templates** and press **Open in the Builder** on one. Then in the Builder press **Save**, then go to **Workflows** and press **Practice run**. A practice run only writes down what each step would do. Then open **Runs**, find your practice run and press the **Approve** button.

| Template | What it does |
| --- | --- |
| Which task should I do first? | the AI reads your Linear tasks |
| What is in my inbox? | the AI reads who wrote to you and the subjects (never the text) |
| What did I work on lately? | the AI reads the names of your latest Drive files |
| My week ahead | the AI reads your Google Calendar |
| Is my website up? | the AI looks at one web page |

## 3. Things that write (they need extra care)

- **Add a row** puts one line into a Google Sheet you name. Paste the sheet's web address in the step.
- **Create Linear task** adds one new task in Linear.
- Both can use **`{answer}`** to use what an **Ask the AI** step said. The order is: Practice run, approve the Ask the AI step, press **Back to the practice run**, then approve the row or task. You see the exact words before you approve.
- A writing step can be approved only **once** per practice run, so you cannot add it twice by mistake.

## 4. If something goes wrong

- A red message under an Approve button says what happened. "Google refused" or "Linear refused" almost always means: press Disconnect, then Connect again.
- "The Gmail API is switched off" means step 1.2 above is not finished.
- Delete any run you do not want with **Delete this run** (it only removes the record, nothing else).
