export const CATCHES = [
  { k: 'concentration', t: 'Customers you depend on too much', d: 'When a few buyers carry the business.' },
  { k: 'profitability', t: 'Products that lose money', d: 'Hidden inside categories that look profitable.' },
  { k: 'returns', t: 'Returns and cancellations', d: 'Which products keep coming back, and what it costs.' },
  {
    k: 'retention',
    t: 'Customers who stopped buying',
    d: 'Your best buyers going quiet, and new ones not returning.',
  },
  { k: 'product', t: 'Products that stopped selling', d: 'Sold this time last year, nothing now.' },
  {
    k: 'anomaly',
    t: 'Sales or products falling behind',
    d: 'Your main products and countries compared with the rest, and with last year.',
  },
  { k: 'concentration', t: 'Sales stuck in one market', d: 'When almost every sale comes from one country.' },
  { k: 'outlier', t: 'Relying on a few huge orders', d: 'When a handful of big orders carry the year.' },
  {
    k: 'seasonality',
    t: 'Seasonal sales dips',
    d: "When most of the year's money lands in a few months.",
  },
  { k: 'data-quality', t: 'Messy records', d: 'Duplicates, missing customers, fees mixed into sales.' },
];
export const RULES = [
  {
    t: 'Same period last year',
    d: 'Recent weeks are compared with the same weeks a year earlier, so a holiday rush never looks like growth.',
  },
  {
    t: 'Only real changes count',
    d: 'A drop counts only if it passes a statistical test, adjusted for checking many products at once. Weaker signals are shown as "not confirmed".',
  },
  {
    t: 'Every number is calculated',
    d: 'Totals, percentages and money come from code. AI explains and suggests; the code checks.',
  },
  {
    t: 'Estimates say so',
    d: 'What a fix could be worth is labeled an estimate, with the formula and your numbers shown.',
  },
];

/**
 * The problem, link by link. Every figure has a public source; correlations are labelled as such. Kept in one place
 * so the site, the README and the pitch all say the same thing.
 */
const pc = (n: number) => `${n.toFixed(1)}%`;
const pc0 = (n: number) => `${Math.round(n)}%`;
export interface Evidence {
  id: string;
  link: string;
  c: string;
  stats: { v: number; f: (n: number) => string; c?: string }[];
  claim: string;
  source: string;
  url: string;
  caveat: string;
}
export const EVIDENCE: Evidence[] = [
  {
    id: 'scale',
    link: 'They carry the economy',
    c: 'var(--sky)',
    stats: [{ v: 36.2, f: (n: number) => `${n.toFixed(1)}M` }],
    claim: 'US small businesses. They employ 62.3 million people, 45.9% of private-sector workers.',
    source: 'SBA Office of Advocacy, Feb 2026',
    url: 'https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/',
    caveat: '',
  },
  {
    id: 'survival',
    link: 'Most don’t last',
    c: 'var(--amber)',
    stats: [{ v: 34.7, f: pc }],
    claim: 'of new business establishments are still open after 10 years. Half are gone within 5.',
    source: 'US Bureau of Labor Statistics, 2013 cohort',
    url: 'https://www.bls.gov/opub/ted/2024/34-7-percent-of-business-establishments-born-in-2013-were-still-operating-in-2023.htm',
    caveat: '',
  },
  {
    id: 'repeat',
    link: 'Repeat customers separate the survivors',
    c: 'var(--violet)',
    stats: [
      { v: 29.0, f: pc, c: 'var(--amber)' },
      { v: 7.7, f: pc, c: 'var(--emerald)' },
    ],
    claim:
      'unprofitable among shops where repeat customers bring under 25% of revenue, vs shops where they bring over half.',
    source: 'Small Business Expo survey of 1,100+ owners, 2026',
    url: 'https://www.thesmallbusinessexpo.com/blog/repeat-customers-profitability/',
    caveat: 'An association, not proof of cause',
  },
  {
    id: 'blind',
    link: 'Owners have the data but can’t read it',
    c: 'var(--fuchsia)',
    stats: [{ v: 53, f: pc0 }],
    claim: 'of small and mid-size businesses don’t know what insights their own data could give them.',
    source: 'AWS survey of 800+ SMB leaders, 2023',
    url: 'https://aws.amazon.com/blogs/smb/why-small-and-medium-businesses-are-missing-out-on-the-full-benefits-data-can-provide',
    caveat: 'Vendor survey',
  },
  {
    id: 'tracking',
    link: 'Few track customers properly',
    c: 'var(--emerald)',
    stats: [{ v: 30, f: pc0 }],
    claim:
      'use CRM or loyalty data to see where customers come from. 32% rely on conversations; 8% track nothing. Formal trackers were more than twice as likely to grow (51% vs 22%).',
    source: 'PYMNTS Intelligence, 526 US SMBs, 2026',
    url: 'https://www.pymnts.com/report/study/the-smb-growth-gap-what-leaders-track-that-others-miss/',
    caveat: 'Growth link is a correlation',
  },
];

/** The verified case-study figures (UCI Online Retail II, 25% customer sample) used across the site. */
export const CASE = {
  accounts: 10,
  spendText: '£93,531',
  topShare: 41,
  topOrderDays: 2,
  replay: {
    since: 'Sep 1, 2011',
    listed: 14,
    back: 7,
    days: 100,
    salesText: '£16,044',
    baselinePct: 53,
  },
};
