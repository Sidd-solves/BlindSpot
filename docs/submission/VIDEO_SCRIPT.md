# BlindSpot demo video: full script (2:45)

**Rules it follows:**
- Name the person and their frustration in the first 15 seconds, with the product on screen by then.
- Show the core loop by 1:30.
- End on what changes for the owner.
- Every number on screen is real and visible in the app.
- Every claim matches what the data can support.

**Timing (measured):** the narration below is 301 words. Each scene was read aloud by macOS text-to-speech with its rate set to 130 and timed. The voice skips the pauses a person makes, so its measured effective rate was about 147 words per minute. Treat these numbers as a floor, not a forecast:

| Scene | Words | Spoken at 130 wpm | Slot | Left for clicks and pauses |
|---|---|---|---|---|
| 0:00–0:14 The hook | 22 | 9.2s | 14s | 4.8s |
| 0:14–0:30 Why it matters | 34 | 13.2s | 16s | 2.8s |
| 0:30–0:45 Meet BlindSpot | 26 | 11.1s | 15s | 3.9s |
| 0:45–1:08 Find | 48 | 19.7s | 23s | 3.3s |
| 1:08–1:30 Evidence | 47 | 17.6s | 22s | 4.4s |
| 1:30–1:50 Decide and act | 36 | 14.5s | 20s | 5.5s |
| 1:50–2:25 Recheck | 48 | 21.2s | 35s | 13.8s |
| 2:25–2:38 What changes | 30 | 10.8s | 13s | 2.2s |
| 2:38–2:45 Close | 10 | 5.3s | 7s | 1.7s |

Total TTS time is 123s of 165s. A person at a calm 130 words per minute would take about 139s, leaving about 26s for clicks and pauses. The recheck scene has the most room, because it has the most to show. **The deciding test is one complete human run:** final wording, real clicks, a stopwatch. It must finish by 2:45 with every number readable. A captioned draft recording of the real clicks is at `docs/submission/demo-draft.webm`. Do one timed read-through with the real clicks before recording. If it runs over, cut the 2:25–2:38 scene first.

**Interaction timing (measured):** a scripted run of the real clicks on the local build, case study loaded:

| Step | Time |
|---|---|
| Home hero visible | 0.8s |
| Load the case study and open Overview | 1.7s |
| Customer Radar list and the rule validation panel ready | 0.9s |
| Tick 4 and start the list | 0.3s |
| "Write with AI": note written and checked | 4.5s |
| Switch to practice, start and recheck | 1.3s |

The only wait longer than a second is the AI note. In the 1:30 scene it fits inside the 5.5s left after the narration. To keep the take smooth, press "Write with AI" just before saying "Claude drafts".

**Before recording:**
- Browser at 1440×900, cursor highlight on.
- Signed in, with the case study loaded (Data Sources → "Switch to this shop").
- Customer Radar with no open list.
- Filters cleared.
- Captions burned in.

---

### 0:00–0:14 · The hook
**On screen:** home hero, "Your best customers don't say goodbye."

> "Your best customer won't tell you they're leaving. They just stop ordering. And because your total sales still look fine, nobody notices."

### 0:14–0:30 · Why it matters
**On screen:** scroll to "Why this problem matters". Hold on the 29.0% vs 7.7% card.

> "In one survey, businesses getting more of their revenue from repeat customers were far less likely to report a loss. Big retailers pay analysts to watch for this. A small shop has a spreadsheet."

### 0:30–0:45 · Meet BlindSpot
**On screen:** click "See it on a real shop". The Overview loads, and the AI briefing's numbers underline green.

> "This is BlindSpot, on public historical sales from a UK online shop. Claude writes the briefing, and each number it writes is matched against the analysis."

### 0:45–1:08 · Find
**On screen:** Customer Radar → the Follow-up card: 10 customers, £93,531, and the amber "one account is 41%" note.

> "Here's what the total hides. Ten of this shop's best customers have gone quiet: ninety-three thousand pounds the year before. And BlindSpot shows the catch: one account is forty-one percent of that, with only a few orders. So you see each customer's rhythm, not just a big number."

### 1:08–1:30 · Evidence
**On screen:** a finding's "See the affected rows", reconciled to the penny. Back to Radar: the Follow-up card's right panel, "This rule, tested on this shop's past" (25 flagged: 32% stayed away vs 8% of other top customers; 14 flagged: 36% vs 3%).

> "Every amount opens into the exact rows behind it. And this exact rule was tested on the shop's own past: flagged customers stayed away far more often than other top customers. But most came back. So it's a list to review first, not a list of losses."

### 1:30–1:50 · Decide and act
**On screen:** tick four customers → "Start a list with 4" → expand one → **press "Write with AI" first, as the scene opens**, then narrate while it writes (3.8–4.5s measured). The note appears with its "checked" label. Mark it Contacted, and the day appears. If the note takes longer than about 8s, cut the wait in the edit and keep the "checked" label on screen. Don't present a cut wait as the real response time.

> "You choose who to contact. Claude drafts a short note from what each one used to buy, checked first: no amounts, no discounts, no telling them they've left. You send it, and BlindSpot logs the day."

### 1:50–2:25 · Recheck
**On screen:** "New list" → "Practice on past data". The blue "Historical replay: no outreach recorded" banner. Select all → start → "Check the shop's real later orders". The ring fills: 7 of 14, £16,044, and the window read.

> "Later, upload a newer export. BlindSpot checks who ordered again after each customer's own contact day, so an order placed before your email never counts. Here it is on this shop's real history, where nobody was contacted: of fourteen quiet customers, seven ordered again within a hundred days."

### 2:25–2:38 · What changes
**On screen:** the Account → Follow-ups tab with the saved list. A quick cut to the analyst answering a question.

> "Your lists and notes are saved privately to your account. Next month you won't be guessing which regulars to call. You'll know who to review, and see who ordered afterward."

### 2:38–2:45 · Close
**On screen:** logo on the sunset, with "Your best customers don't say goodbye. Now you'll notice."

> "BlindSpot. Your best customers don't say goodbye. Now you'll notice."

---

## Delivery notes

- **Rehearse 0:00–0:30 out loud** until it lands without notes. That stretch decides how closely a judge watches the rest.
- **Say every number slowly,** and keep it on screen while you say it.
- **Keep the honesty lines:** "a sample of its customers", "most still came back", "no one was contacted". They're why a judge believes the rest.
- **Never call £16,044 recovered revenue.** It's what customers ordered in the shop's real records, with no outreach.
- **One idea per scene.** Don't narrate menus. Say what the owner gets.

## Thumbnail

`docs/submission/thumbnail.png` (1280×720, built from `thumbnail.html`):
- Background: dark sunset with hill silhouettes.
- Left: a rising bar chart with one amber "regular" segment fading out, labeled "went quiet".
- Right: "Your best customers don't say goodbye." with the BlindSpot logo underneath.
