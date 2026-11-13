# BlindSpot

**One line:** BlindSpot helps independent online shops find the valuable customers who have gone quiet, check the evidence, reach out, and see who comes back.

## Description

**The problem.** A shop's best customer doesn't say goodbye. They stop ordering, and the sales total still looks fine. In one survey of 1,100+ owners, 29.0% of businesses getting under a quarter of revenue from repeat customers reported being unprofitable, against 7.7% of those getting over half (Small Business Expo, 2026; an association, not proof). And 53% of SMB executives in an AWS survey didn't know what insights their own data could provide. Big retailers pay analysts for this. Small shops have an export.

**What BlindSpot does.** Upload a Shopify, Etsy or Square export, a spreadsheet, a PDF, or a photo of a table. Then:

1. **Find** top customers silent for 90 days, with each one's rhythm and share of the total.
2. **Decide** who to contact, after opening the exact rows behind every amount.
3. **Act**: Claude drafts a note for each; you send it and log the day.
4. **Recheck** with a newer export from the same shop: matched by customer ID, it shows who ordered after the list and after each contact, and flags data gaps.

**AI, checked.** Claude writes briefings and notes, reads photos, and answers questions using 21 tools. Its numbers are matched against tool results; unmatched ones go back. Notes are rejected if they quote money or periods, offer discounts, or say the customer left; product names are filled in from the customer's own purchases.

**Evidence.** On a public UK retailer's records (UCI Online Retail II), 10 quiet top accounts had spent £93,531.25 the year before, matched to the penny by a separate Python script. Replayed on that shop's past, flagged customers stayed away 32–36% of the time against 3–8% for other top regulars (Fisher p < 0.005 in both replays). Most came back: it's who to review first, not a list of losses.

## Full Devpost story (for events using the standard sections)

### Inspiration
I kept seeing the same story in small online shops. Sales looked fine, while a loyal wholesale buyer had quietly stopped ordering months earlier. Nobody noticed, because every chart showed the total. Big retailers pay analysts to watch for this. A small shop has an export it can't read. So I set out to build the analyst a small shop can't afford, with one rule: every number must trace back to rows you can check.

### What it does
BlindSpot reads a shop's sales export as it is (Shopify, Etsy, Square, a spreadsheet, a PDF report, or a photo of a table) and cleans it. Then it runs a loop:
- **Find:** the top customers who have gone quiet, with each one's usual order rhythm and share of the total.
- **Decide:** who to contact, after opening the exact rows behind every amount.
- **Act:** a short note drafted by Claude for each, checked before you see it. You send it and log the day.
- **Recheck:** upload a newer export. Matching by customer ID, it shows who ordered after the list and after each contact, and flags gaps in the data.

### How I built it
- TypeScript throughout: React, Vite, Tailwind, Framer Motion and WebGL on the front end; Node and Express on the server.
- Supabase for accounts and saved lists, with row-level security.
- The analysis engine is plain code with its own statistics (Welch and Fisher tests, Benjamini–Hochberg), kept separate from the AI.
- Claude (Sonnet 5.5) uses 21 read-only tools. Its numbers are matched against the tool results, and its outreach notes are checked for amounts, dates, discounts and product names.

### Challenges
- **Proving the rule.** I replayed it on the shop's own past using only earlier data. Flagged customers stayed away 32–36% of the time, against 3–8% for other top customers. Most still came back, so I present it as a list to review, not a list of losses.
- **Measuring follow-up honestly.** An order counts as "after contact" only if it falls on a later day than that customer's own contact.

### Accomplishments
- A separate Python script reproduces the app's 10 accounts, their orders, gaps and the £93,531.25 total, to the penny.
- 283 automated tests, plus browser tests, including one proving that switching accounts never shows another account's lists.

### What I learned
Evidence beats a dramatic number. Showing "one account is 41% of this total" and "most came back" makes people trust the rest.

### What's next
Test it with a real shop owner on their own export, and record what they agree and disagree with. After that, live connectors for WooCommerce and Square.

## Built with

Claude (Anthropic API, Sonnet 5.5), TypeScript, React, Vite, Tailwind CSS, Framer Motion, WebGL, Node.js, Express, Supabase (auth, Postgres with row-level security), Zod, Model Context Protocol, pdf.js, SheetJS, Papa Parse, Vitest, Playwright, Docker, Render.

## Try it

- Live app: (Render URL)
- Code: https://github.com/Sidd-solves/BlindSpot
- Demo video: (YouTube link)

## Statistics and sources

| Figure | Source |
|---|---|
| 36.2M US small businesses; 62.3M jobs (45.9% of private-sector workers) | [SBA Office of Advocacy, Feb 2026](https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/) |
| 29.0% vs 7.7% reported unprofitable, by share of revenue from repeat customers (association) | [Small Business Expo, 2026, 1,100+ owners](https://www.thesmallbusinessexpo.com/blog/repeat-customers-profitability/) |
| 53% of SMB executives surveyed don't know what insights their data could provide (vendor survey, worldwide) | [AWS, 2023, 800+ SMB leaders](https://aws.amazon.com/blogs/smb/why-small-and-medium-businesses-are-missing-out-on-the-full-benefits-data-can-provide) |
| Case study: UCI Online Retail II (CC BY 4.0) | [Chen (2012), UCI ML Repository](https://doi.org/10.24432/C5CG6D) |

Left out on purpose: business-survival rates (they don't show why businesses close), acquisition-tracking survey figures (they measure a different thing), and the widely repeated "5% more retention = 25–95% more profit" and "5–25× cheaper to keep a customer" figures, which we could not trace to a primary source.
