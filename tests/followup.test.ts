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

describe('follow-up timing and coverage', () => {
  it('counts only orders on days strictly after each contact, and same-day orders apart', () => {
    // List made Jul 1; A orders Aug 15. Contacted Aug 20 → that order is BEFORE contact, never "after contact".
    const late = followUpCheck(shop(), '2025-07-01', ['A'], { A: '2025-08-20' });
    expect(late.accounts[0]).toMatchObject({ ordersAfter: 1, ordersAfterContact: 0, sameDayOrders: 0 });
    expect(late.contacted).toEqual({ customers: 1, orderedAfter: 0, salesAfter: 0, sameDay: 0 });
    // Contacted on the order day itself: timing unknown, counted apart, not as "after contact".
    const same = followUpCheck(shop(), '2025-07-01', ['A'], { A: '2025-08-15' });
    expect(same.accounts[0]).toMatchObject({ ordersAfterContact: 0, sameDayOrders: 1 });
    expect(same.contacted.sameDay).toBe(1);
    // Contacted before the order: counted.
    const early = followUpCheck(shop(), '2025-07-01', ['A', 'B'], { A: '2025-08-01' });
    expect(early.accounts[0]).toMatchObject({ ordersAfterContact: 1, salesAfterContact: 250 });
    expect(early.notContacted).toEqual({ customers: 1, orderedSince: 0 });
  });
  it('dedupes IDs, rejects impossible dates, and reports gaps in coverage', () => {
    const r = followUpCheck(shop(), '2025-07-01', ['A', 'A', 'B']);
    expect(r.accounts.map((a) => a.customer)).toEqual(['A', 'B']);
    expect(followUpCheck(shop(), '2025-02-30', ['A']).ok).toBe(false);
    const bad = followUpCheck(shop(), '2025-07-01', ['A'], { A: '2025-13-01' });
    expect(bad.accounts[0].contactedOn).toBeNull();
    // The tiny shop only sells on the 10th of each month: long stretches with no rows at all → thin coverage.
    expect(r.coverage?.thin).toBe(true);
    expect(r.coverage?.longestGapDays).toBeGreaterThanOrEqual(21);
    expect(r.accounts.find((a) => a.customer === 'B')?.outcome).toBe('no-order-seen');
  });
  it('keeps leading zeros in customer IDs as distinct strings', () => {
    const ds = shop();
    (ds.rows as any[]).push(
      { OrderDate: '2025-09-01', Customer: '00123', Order: 'Z1', Sales: 10, Product: 'Mug', IsReturn: 0 },
      { OrderDate: '2025-09-02', Customer: '123', Order: 'Z2', Sales: 20, Product: 'Mug', IsReturn: 0 },
    );
    const r = followUpCheck(ds, '2025-08-25', ['00123']);
    expect(r.accounts[0]).toMatchObject({ found: true, ordersAfter: 1, salesAfter: 10 });
  });
});
