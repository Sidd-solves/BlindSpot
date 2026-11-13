# BlindSpot demo video: full script (3:00)

**Structure:**
1. **Hard numbers first.** The problem in public statistics, then in one real shop's data.
2. **Every feature, fast.**
3. **One game-changing feature, slowly:** the proof chain.
4. **How it works underneath, layer by layer.**
5. **A close on the numbers.**

Every number is real. The opening statistics are sourced below; the shop's numbers appear in the app as you say them.

**Recording:** `node scripts/demo/record.mjs && node scripts/demo/encode.mjs` produces a captioned draft at `docs/submission/demo-draft.webm`, with the real clicks, a real Claude call, on-screen stat cards and the layer diagram. Record your voice over it, or re-record the clicks yourself following the same timings.

---

### 0:00–0:12 · Stat burst
**On screen:** black. Three numbers slam in, each with its source underneath.

> "36 million small businesses in America. 53% of small-business leaders say they don't know what their own data could tell them. And in one survey, businesses with little repeat revenue were almost four times as likely to lose money: 29% versus 7.7%."

### 0:12–0:25 · The dashboard lies
**On screen:** a "+6.2%" sales card. The hidden problems drop in under it, one by one, with their numbers.

> "This real shop's dashboard said sales were up 6.2%. Underneath: ten best customers gone quiet, worth £93,531. New customers coming back less, 51% to 42%. Twenty-three products dead. And £114,000 of orders reversed within two days, padding the total."

### 0:25–0:52 · Every feature in 27 seconds
**On screen:** fast cuts, one per page, each with its name chip.

> "Open BlindSpot and it's all there. Overview: a health score and the one problem to fix first. Data Sources: Shopify, CSV, Excel, PDF, even a photo. Source Data: every row, and how it was cleaned. AI Analyst: ask in plain English. Risk Intelligence: every problem ranked by money and labelled by how sure it is. Customer Radar: who's slipping away. Stock and Cash: sales gaps that look like stock-outs. Prove It: did the promo really work? Simulator: what a fix could be worth. Forecast: next months, with its past accuracy shown. Dashboard Audit: misleading charts and colours. Reports: a 30, 90 and 180-day plan, in 30 currencies."

### 0:52–1:25 · The game-changer: the proof chain
**On screen:** slower. The label "★ THE PROOF CHAIN" stays up. Finding → exact rows → the rule tested on the past → a follow-up list with a checked AI note → the recheck.

> "But this is what makes BlindSpot different. Most dashboards give you a number and ask you to trust it. BlindSpot makes every number prove itself. Click a finding: here are the exact orders, adding up to the penny. Was the rule ever right? Here it is replayed on this shop's own past: flagged customers really did stay away far more often. Then act: pick who to contact, and Claude drafts a checked note. Upload next month's file, and BlindSpot shows who ordered again, counting only orders after your contact. Finding, proof, action, result, in one loop. No dashboard does that."

### 1:25–2:45 · Under the hood
**On screen:** the six-layer diagram, each layer lighting up as it's named, with its technical labels.

> "Underneath, six layers. The reader runs in your browser: SheetJS, Papa Parse with our own separator detection, and pdf.js rebuilding PDF tables from each word's x and y position, with columns scored by name and value in eight languages. The server is Node and Express: isolated sessions in 512 megabytes, a dictionary-encoded million-row dataset, and caches warmed before the first request. The engine is pure TypeScript with zero AI, deterministic and memoized per dataset: Welch t-tests, z-tests, Fisher exact tests, 2,000-sample bootstraps, and a Benjamini–Hochberg correction against false alarms, always against the same weeks last year. The proof layer: an independent Python script matches seven of seven headline numbers and all ten accounts, row for row. The AI layer: 41 Zod-typed tools over REST and the Model Context Protocol. Claude gets 21 read-only ones, never does the math, and a fact-checker matches every number it writes against the tool output. And accounts: Supabase Postgres with PKCE sign-in and row-level security, tested with throwaway users."

### 2:45–3:00 · Close
**On screen:** stat card: "~40,000 lines · 290 tests + 6 browser tests · 41 tools · 1,067,371 real rows", then the logo.

> "Forty thousand lines. 290 tests. A million real rows. Your dashboard shows what happened. BlindSpot shows what it's hiding."

---

## Delivery notes

- **The two speeds are deliberate.** Read the feature tour and the layers briskly. Slow down for the proof chain: everything around it moves fast so it stands out.
- **Say every number while it's on screen.**
- **Keep the honest words:** "in one survey" and "counting only orders after your contact".
- **If an event's limit is 2:45,** cut the layer list to four: reader, engine, proof and AI.
- **Burn in captions.** Many judges watch muted.

## Sources for the opening statistics

| Figure | Source |
|---|---|
| 36.2 million US small businesses | [SBA Office of Advocacy, Feb 2026](https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/) |
| 53% of SMB leaders don't know what insights their data could provide | [AWS survey of 800+ SMB leaders, 2023](https://aws.amazon.com/blogs/smb/why-small-and-medium-businesses-are-missing-out-on-the-full-benefits-data-can-provide) (a vendor survey) |
| 29.0% vs 7.7% reported being unprofitable, by repeat-revenue share | [Small Business Expo survey of 1,100+ owners, 2026](https://www.thesmallbusinessexpo.com/blog/repeat-customers-profitability/) (an association, not proof of cause) |

The shop numbers come from BlindSpot on UCI Online Retail II (public historical data, 25% customer sample):
- +6.2% growth, from the same-weeks comparison
- 10 quiet accounts, £93,531
- returning new customers, 51% to 42% (p = 0.002)
- 23 products stopped (£36,302)
- 509 reversed lines (£114,284)
