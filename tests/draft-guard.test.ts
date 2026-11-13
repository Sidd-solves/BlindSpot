import { describe, expect, it } from 'vitest';
import { checkDraft } from '../services/api/src/verify';

const facts = {
  topProducts: ['WHITE HANGING HEART T-LIGHT HOLDER', 'JUMBO BAG RED RETROSPOT'],
  catalog: ['WHITE HANGING HEART T-LIGHT HOLDER', 'JUMBO BAG RED RETROSPOT', 'REGENCY CAKESTAND 3 TIER'],
};
const ok =
  'Hi there, we hope you are well. Your white hanging heart t-light holder is back in stock if you need more. If anything was not right last time, just reply. Thank you, Our Shop';

describe('AI outreach draft guard (adversarial)', () => {
  it('passes a plain, specific, honest note', () => {
    expect(checkDraft(ok, facts)).toEqual([]);
  });
  it.each([
    ['names the wrong product', 'Our Regency Cakestand 3 Tier would suit you!', /didn't usually buy/],
    ["uses another account's amount", 'You spent £37,994.90 with us last year.', /money/],
    ['quotes an order count', 'Thanks for your 12 orders!', /order count/],
    ['changes the period', 'It has been 235 days since your last order.', /time period/],
    ['invents a discount', 'Here is a 20% off coupon just for you.', /discount/],
    ['claims they are leaving', "We noticed you've stopped ordering with us.", /left or stopped/],
  ])('flags a draft that %s', (_, text, want) => {
    const p = checkDraft(text, facts);
    expect(p.length).toBeGreaterThan(0);
    expect(p.join(' ')).toMatch(want);
  });
  it('allows the products the customer really bought', () => {
    expect(checkDraft('Your Jumbo Bag Red Retrospot is waiting.', facts)).toEqual([]);
  });
});
