import { describe, expect, it } from 'vitest';
import { applyEdit, uniqueAccounts, validDay, type FollowList } from '../apps/web/src/lib/followups';

const acc = (customer: string, extra = {}) => ({
  customer,
  email: null,
  spend: 100,
  share: 50,
  orders: 4,
  typicalGapDays: 20,
  daysSilent: 120,
  lastOrder: '2025-01-01',
  status: 'todo' as const,
  contactedOn: null,
  note: '',
  ...extra,
});
const list = (replay = false): FollowList => ({
  id: 'L',
  name: 'Follow-up',
  since: '2025-05-01',
  source: 'Shop A export',
  replay,
  meta: { dataEnd: '2025-04-30', currency: 'GBP', rule: 'r', total: 200 },
  accounts: [acc('A'), acc('B')],
  last_check: null,
  created_at: '',
  updated_at: '',
});

describe('saved-list snapshot rules', () => {
  it('never lets an edit change the frozen selection, date, source or meta', () => {
    const o = list();
    const tampered = {
      ...o,
      since: '2020-01-01',
      source: 'Other shop',
      meta: { ...o.meta, total: 999 },
      accounts: [
        { ...acc('A'), spend: 1, share: 99, status: 'contacted' as const, contactedOn: '2025-05-03' },
      ],
    };
    const n = applyEdit(o, tampered);
    expect(n.since).toBe('2025-05-01');
    expect(n.source).toBe('Shop A export');
    expect(n.meta.total).toBe(200);
    expect(n.accounts[0]).toMatchObject({
      spend: 100,
      share: 50,
      status: 'contacted',
      contactedOn: '2025-05-03',
    });
    expect(n.accounts[1]).toEqual(o.accounts[1]);
  });
  it('clears the contact day when undoing Contacted, and keeps a valid correction', () => {
    const o = { ...list(), accounts: [acc('A', { status: 'contacted', contactedOn: '2025-05-03' })] };
    const undone = applyEdit(o, { ...o, accounts: [{ ...o.accounts[0], status: 'todo' as const }] });
    expect(undone.accounts[0].contactedOn).toBeNull();
    const fixed = applyEdit(o, { ...o, accounts: [{ ...o.accounts[0], contactedOn: '2025-05-02' }] });
    expect(fixed.accounts[0].contactedOn).toBe('2025-05-02');
    const bad = applyEdit(o, { ...o, accounts: [{ ...o.accounts[0], contactedOn: '2025-02-31' }] });
    expect(bad.accounts[0].contactedOn).toBe('2025-05-03');
  });
  it('a historical replay can never record a contact', () => {
    const o = list(true);
    const n = applyEdit(o, {
      ...o,
      accounts: [{ ...acc('A'), status: 'contacted' as const, contactedOn: '2025-05-03' }],
    });
    expect(n.accounts[0]).toMatchObject({ status: 'todo', contactedOn: null });
    expect(n.replay).toBe(true);
  });
  it('dedupes IDs and validates calendar days', () => {
    expect(uniqueAccounts([acc('A'), acc('A'), acc('B')]).map((a) => a.customer)).toEqual(['A', 'B']);
    expect(validDay('2024-02-29')).toBe(true);
    expect(validDay('2025-02-29')).toBe(false);
    expect(validDay('2025-5-1')).toBe(false);
  });
});
