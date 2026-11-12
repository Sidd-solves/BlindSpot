# BlindSpot

**One line:** BlindSpot helps independent online shops find the valuable customers who have gone quiet, check the evidence, reach out, and see who comes back.

## Description

**The problem.** A shop's best customer doesn't say goodbye. They just stop ordering, while the sales total still looks fine. Repeat customers matter: among 1,100+ owners, 29.0% of shops getting under a quarter of revenue from repeat buyers were unprofitable, against 7.7% of shops getting over half (Small Business Expo, 2026; an association). Yet 53% of small and mid-size businesses don't know what their own data could tell them (AWS, 2023), and only 30% use CRM or loyalty data (PYMNTS, 2026). Big retailers pay analysts to catch a regular drifting away. A small shop has an export it can't read.

**What BlindSpot does.** Upload a Shopify, Etsy or Square export, a spreadsheet, a PDF report or a photo of a sales table. BlindSpot cleans it, then runs a loop:

1. **Find** top customers with no order in 90 days, with each one's usual rhythm and share of the total.
2. **Decide** who to contact, after one click shows the exact rows behind every amount.
3. **Act** with a personal note drafted by Claude, and log who you reached.
4. **Recheck** with a newer export: matched by customer ID, it shows who ordered again and what they spent.

**AI, checked.** Claude writes the briefing and notes, reads photos, and answers questions using 21 read-only analysis tools. Every figure it writes is fact-checked against tool results; wrong ones go back for correction.

**Proof.** On a public UK retailer's records (UCI Online Retail II), 10 quiet top accounts had spent £93,531.25 the year before, matched to the penny by a separate Python script. Replayed on that retailer's past, flagged customers stayed away 32–36% of the time, against 3–8% for other top regulars (Fisher p ≤ 0.004). Most still returned, so it's a who-to-call-first list, not a loss.

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
| 34.7% of establishments open after 10 years; 50.6% after 5 | [BLS, 2013 cohort](https://www.bls.gov/opub/ted/2024/34-7-percent-of-business-establishments-born-in-2013-were-still-operating-in-2023.htm) |
| 29.0% vs 7.7% unprofitable by repeat-revenue share (association) | [Small Business Expo, 2026, 1,100+ owners](https://www.thesmallbusinessexpo.com/blog/repeat-customers-profitability/) |
| 53% don't know what insights their data could provide (vendor survey) | [AWS, 2023, 800+ SMB leaders](https://aws.amazon.com/blogs/smb/why-small-and-medium-businesses-are-missing-out-on-the-full-benefits-data-can-provide) |
| 30% use CRM/loyalty data; 8% track nothing; 51% vs 22% grew (correlation) | [PYMNTS Intelligence, 2026, 526 SMBs](https://www.pymnts.com/report/study/the-smb-growth-gap-what-leaders-track-that-others-miss/) |
| Case study: UCI Online Retail II (CC BY 4.0) | [Chen (2012), UCI ML Repository](https://doi.org/10.24432/C5CG6D) |

Left out on purpose: the widely repeated "5% more retention = 25–95% more profit" and "5–25× cheaper to keep a customer" figures, which we could not trace to a primary source.
