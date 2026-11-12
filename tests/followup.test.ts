import { describe, expect, it } from 'vitest';
import { followUpCheck, sliceBefore, winBackList } from '@blindspot/analytics';
import type { Dataset } from '@blindspot/analytics';

/** Tiny shop: A and B are regulars who stop in spring; A comes back in summer, B doesn't. C keeps ordering. */
function shop(): Dataset {
  const rows: any[] = [];
  let n = 0;
  const add = (c: string, d: string, s: number, ret = 0) =>
    rows.push({ OrderDate: d, Customer: c, Order: `O${++n}`, Sales: s, Product: 'Mug', IsReturn: ret });
  for (const m of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'])
      add(c, `2024-${m}-10`, c === 'A' ? 900 : 100);
  for (const m of ['01', '02', '03']) for (const c of ['A', 'B', 'C']) add(c, `2025-${m}-10`, 100);
  for (const m of ['04', '05', '06', '07', '08', '09', '10', '11', '12']) add('C', `2025-${m}-10`, 100);
  add('A', '2025-08-15', 250);
  add('A', '2025-08-20', -50, 1); // a return after the date: not counted as sales
  return { name: 't', rows, currency: 'USD' } as unknown as Dataset;
}

describe('follow-up check', () => {
  it('replays the list as of a past date using only earlier rows', () => {
    const past = sliceBefore(shop(), '2025-07-01');
    expect(past.rows.every((r: any) => r.OrderDate < '2025-07-01')).toBe(true);
    const wb = winBackList(past);
    expect(wb.asOf).toBe('2025-06-10'); // the last day with any row before the cutoff
    expect(wb.customers.map((c) => c.customer)).toEqual(expect.arrayContaining(['A']));
    const total = wb.customers.reduce((s, c) => s + (c.share ?? 0), 0);
    expect(Math.round(total)).toBe(100);
  });
  it('counts real later orders by exact ID, excludes returns, and reports unknown IDs', () => {
    const r = followUpCheck(shop(), '2025-07-01', ['A', 'B', 'a', 'Z']);
    expect(r.ok).toBe(true);
    const by = Object.fromEntries(r.accounts.map((a) => [a.customer, a]));
    expect(by.A).toMatchObject({
      found: true,
      ordersAfter: 1,
      salesAfter: 250,
      firstOrderAfter: '2025-08-15',
    });
    expect(by.B).toMatchObject({ found: true, ordersAfter: 0, salesAfter: 0 });
    expect(r.unmatched).toEqual(['a', 'Z']); // "a" is not "A": no fuzzy matching
    expect(r.orderedAgain).toBe(1);
    expect(r.matched).toBe(2);
    expect(r.baseline).toEqual({ customers: 9, orderedAgain: 1 });
  });
  it('refuses to report outcomes when the data ends before the list date', () => {
    const r = followUpCheck(sliceBefore(shop(), '2025-05-01'), '2025-07-01', ['A']);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/newer export/);
  });
});
