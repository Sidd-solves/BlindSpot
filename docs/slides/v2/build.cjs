// Builds BlindSpot_deck_v2.pptx from the rendered slide images, with speaker notes.
// Render first: node render (see deck.html), then: node docs/slides/v2/build.cjs
const path = require('path');
const pptxgen = require(path.join(__dirname, '..', 'node_modules', 'pptxgenjs'));
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'BlindSpot v2';
const notes = [
  "Your dashboard shows what happened. BlindSpot shows what it's hiding. It's the analyst a small shop can't afford, built so every number proves itself. The live version is at blindspot-pro.onrender.com.",
  'The problem in numbers. There are 36.2 million small businesses in the US. In an AWS survey, 53% of small-business leaders said they don\'t know what insights their own data could give them. And in one survey of over 1,100 owners, businesses with little repeat revenue reported being unprofitable at 29%, against 7.7% for those where repeat customers bring over half. That is an association, not proof of cause. The data to catch problems already exists. Nobody reads it.',
  "Here's a real shop: the public UK Online Retail II data. Its dashboard said sales were up 6.2% on the same weeks last year. Underneath, 10 best customers had stopped ordering, worth £93,531. New customers were coming back less, 51% down to 42%, a tested result. 23 products had stopped selling. 509 order lines were reversed within two days, £114,284 padding the total. And there were 7,872 duplicate lines.",
  'BlindSpot reads any sales export, cleans it, proves what it finds, and helps you act. It is for anyone who sells to repeat customers.',
  'Everything in the app: 12 tools in one connected workspace. Overview, Data Sources, Source Data, AI Analyst, Risk Intelligence, Customer Radar, Stock and Cash, Prove It, Simulator, Forecast, Dashboard Audit and Reports.',
  'This is the game changer: the proof chain. Dashboards give you a number and ask you to trust it. CRMs list customers but never tell you who is slipping. BlindSpot makes every number prove itself, then shows whether acting on it paid off: finding, exact rows, tested on the past, act, recheck.',
  'Every number opens into its rows. £93,531.25 in the finding, £93,531.25 in the rows behind it. A separate Python script with no shared code matches 7 of 7 headline numbers and all 10 accounts row for row.',
  'The rule was replayed on the shop\'s own history: flagged customers stayed away 32 to 36% of the time over the next 180 days, against 3 to 8% for other top customers, with Fisher exact p below 0.005. Most still came back, so it is a list to review first. After you act, the recheck counts only orders after each customer\'s own contact day. In a historical replay with no outreach, 7 of 14 ordered again.',
  'AI on a leash. Claude explains; the math decides. 41 Zod-typed tools over REST and the Model Context Protocol, 21 read-only ones for Claude. A fact-checker matches every number Claude writes to tool output. Outreach notes are rejected for amounts, dates, discounts or telling customers they left.',
  'Six layers. The reader runs in your browser: SheetJS, Papa Parse, pdf.js word positions, 8 languages, Claude vision for photos. A Node and Express server with isolated sessions in 512 MB. A pure TypeScript engine with zero AI. A proof layer. The AI layer. And accounts on Supabase Postgres with PKCE sign-in and row-level security.',
  'The statistics engine is written from scratch: Welch t-tests, two-proportion z-tests, Fisher exact tests, 2,000-sample bootstraps and Benjamini–Hochberg correction, always against the same weeks last year. Every finding is labelled. It even downgraded its own most dramatic finding to possible, not confirmed.',
  'The reader turns messy files into clean records: exports from the big platforms, CSV, Excel, PDF reports, even a photo of a table. A million real rows are cleaned in about 40 seconds and analysed in about 6 on a 2020 laptop.',
  'Beyond customers: forecasts that show their own track record, a 9.1% average miss over 12 replayed months. Prove It puts promotions on trial. Dashboard Audit catches misleading charts and color-blind problems.',
  "Private and safe by design: row-level security tested with throwaway users, read-only access, guest mode, honest labels, checked AI numbers, and open evidence anyone can reproduce.",
  'By the numbers: about 40,000 lines of code, over 290 automated tests plus 6 browser tests, 41 tools, 1,067,371 real rows, 7 of 7 independent matches, 30 currencies.',
  'Stop trusting totals. Start seeing what they hide. Try it at blindspot-pro.onrender.com. Next: a real shop owner on their own export, more live connectors, and weekly alerts. Thank you.',
];
notes.forEach((n, i) => {
  const s = pres.addSlide();
  s.background = { color: '05060F' };
  s.addImage({ path: path.join(__dirname, `slide-${i + 1}.jpg`), x: 0, y: 0, w: 10, h: 5.625, altText: `BlindSpot v2 slide ${i + 1}` });
  s.addNotes(n);
});
pres.writeFile({ fileName: path.join(__dirname, 'BlindSpot_deck_v2.pptx') }).then((f) => console.log('wrote', f));
