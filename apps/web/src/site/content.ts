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
    link: 'Who this is for',
    c: 'var(--sky)',
    stats: [{ v: 36.2, f: (n: number) => `${n.toFixed(1)}M` }],
    claim: 'small businesses in the US, employing 62.3 million people (45.9% of private-sector workers).',
    source: 'SBA Office of Advocacy, Feb 2026',
    url: 'https://advocacy.sba.gov/2026/02/03/advocacy-releases-frequently-asked-questions-about-small-businesses-2026/',
    caveat: '',
  },
  {
    id: 'repeat',
    link: 'Repeat revenue and profit',
    c: 'var(--violet)',
    stats: [
      { v: 29.0, f: pc, c: 'var(--amber)' },
      { v: 7.7, f: pc, c: 'var(--emerald)' },
    ],
    claim:
      'reported being unprofitable among businesses getting under 25% of revenue from repeat customers, vs those getting over half. In one survey: higher repeat revenue went with fewer losses.',
    source: 'Small Business Expo survey of 1,100+ owners, 2026',
    url: 'https://www.thesmallbusinessexpo.com/blog/repeat-customers-profitability/',
    caveat: 'An association, not proof that keeping customers causes profit',
  },
  {
    id: 'blind',
    link: 'Data they can’t use',
    c: 'var(--fuchsia)',
    stats: [{ v: 53, f: pc0 }],
    claim: 'of SMB executives in one survey said they don’t know what insights their data could provide.',
    source: 'AWS survey of 800+ SMB leaders worldwide, 2023',
    url: 'https://aws.amazon.com/blogs/smb/why-small-and-medium-businesses-are-missing-out-on-the-full-benefits-data-can-provide',
    caveat: 'Vendor survey of executives, not a census of shop owners',
  },
];

/** The verified case-study figures (UCI Online Retail II, 25% customer sample) used across the site. */
export const CASE = {
  accounts: 10,
  spendText: '£93,531',
  topShare: 41,
  topOrders: 3,
  replay: {
    since: 'Sep 1, 2011',
    listed: 14,
    back: 7,
    days: 100,
    salesText: '£16,044',
  },
  /** docs/VALIDATION.md: flagged vs other top regulars staying away 180 days, two replay dates, 25% sample. */
  validation: { flagged: '32–36%', others: '3–8%', p: 'p < 0.005' },
};
