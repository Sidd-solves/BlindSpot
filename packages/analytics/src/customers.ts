/**
 * Customer radar: who is slipping away now (early warning) and who already went quiet (win-back list).
 *
 * Early warning flags repeat customers who have been silent 45–90 days: past the point where most regulars have
 * reordered, but before the 90-day line where they count as lost (they then move to the win-back list). The rule is
 * replayed in the past: flag customers as of 90 days before the data ends, using only orders before that date, then
 * check who really came back, and test that against everyone who wasn't flagged.
 *
 * Why plain silence and not "late for their own rhythm": on the real UK shop, rules based on each customer's usual
 * gap between orders did not predict leaving on either test date (flagged customers came back as often as the
 * rest), while 45+ days of silence did, on a tuning date and again on a later validation date. The rule here is the
 * one that held up on data it wasn't tuned on.
 *
 * The win-back list uses exactly the same definition as the "best customers who stopped ordering" finding, so the
 * list and the finding always agree.
 */
import type { Dataset, Row } from './types';
import { detectFields } from './profile';
import { fisherGreater, propTest } from './stats';
import { DAY, dateSpan, toMs } from './time';

/** Same as the store checks, so the win-back list and the lapsed-customer finding agree exactly. */
const UNKNOWN = new Set(['Unknown customer', 'Guest checkout', '']);
const round2 = (n: number) => Math.round(n * 100) / 100;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b),
    m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
/** Round .5 to the even neighbour, like Python's round(), so the app and the independent check agree to the day. */
const roundHalfEven = (x: number) => {
  const f = Math.floor(x);
  return x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x);
};

interface Order {
  id: string;
  t: number;
  customer: string;
  total: number;
  products: string[];
}

/** The day after the last date in the data (any row), the same "end" the store checks use. */
function endOf(ds: Dataset): number {
  const fm = detectFields(ds);
  return fm.date ? dateSpan(ds.rows, fm.date).max + DAY : 0;
}

/** Sale orders (returns excluded) with their customer, date, total and products. */
function ordersOf(ds: Dataset): Order[] {
  const fm = detectFields(ds);
  if (!fm.date) return [];
  const product = ['Product', 'Description', 'Item', 'Title'].find((c) => ds.rows[0] && c in ds.rows[0]);
  const map = new Map<string, Order>();
  for (const r of ds.rows as Row[]) {
    if (r.IsReturn === 1) continue;
    const customer = String(r.Customer ?? '');
    if (UNKNOWN.has(customer)) continue;
    const id = String(r.Order ?? `${customer}|${r[fm.date]}`);
    let o = map.get(id);
    if (!o) {
      o = { id, t: toMs(r[fm.date]), customer, total: 0, products: [] };
      map.set(id, o);
    }
    o.total += (r[fm.measure] as number) || 0;
    if (product && r[product]) o.products.push(String(r[product]));
  }
  return [...map.values()].filter((o) => Number.isFinite(o.t)).sort((a, b) => a.t - b.t);
}

interface History {
  days: number[]; // distinct order days, ascending
  orders: Order[];
}
function histories(orders: Order[], before: number): Map<string, History> {
  const by = new Map<string, History>();
  for (const o of orders) {
    if (o.t >= before) continue;
    const h = by.get(o.customer) ?? { days: [], orders: [] };
    const d = Math.floor(o.t / DAY);
    if (h.days[h.days.length - 1] !== d) h.days.push(d);
    h.orders.push(o);
    by.set(o.customer, h);
  }
  return by;
}

export const RULE = {
  minOrders: 2,
  minSilentDays: 45,
  maxSilentDays: 90,
  testWindowDays: 90,
};

/** Customers late for their usual reorder at `asOf`, judged only from orders before `asOf`. */
function lateAt(orders: Order[], asOf: number) {
  const out: {
    customer: string;
    orders: number;
    typicalGap: number;
    silent: number;
    last: number;
    yearSpend: number;
    eligible: boolean;
  }[] = [];
  for (const [customer, h] of histories(orders, asOf)) {
    if (h.days.length < RULE.minOrders) continue;
    const gaps = h.days.slice(1).map((d, i) => d - h.days[i]);
    const typicalGap = median(gaps);
    const last = h.orders[h.orders.length - 1].t;
    // Days from their last order to the last day before `asOf` (the last day of data, for "now").
    const silent = Math.floor((asOf - DAY - last) / DAY);
    // Only customers still "active" can be early-warned; long-silent ones are win-back territory.
    const eligible = silent <= RULE.maxSilentDays;
    const yearSpend = h.orders.filter((o) => o.t >= asOf - 365 * DAY).reduce((s, o) => s + o.total, 0);
    out.push({ customer, orders: h.days.length, typicalGap, silent, last, yearSpend, eligible });
  }
  const isLate = (c: (typeof out)[number]) => c.eligible && c.silent >= RULE.minSilentDays;
  return { all: out.filter((c) => c.eligible), late: out.filter(isLate), everyone: out };
}

export interface EarlyWarning {
  ok: boolean;
  reason?: string;
  asOf: string;
  rule: string;
  backtest: {
    asOf: string;
    windowDays: number;
    flagged: number;
    flaggedStayedAway: number;
    others: number;
    othersStayedAway: number;
    /** One-sided: flagged customers stayed away more often than the others. */
    p: number | null;
    method: string;
  } | null;
  customers: {
    customer: string;
    orders: number;
    typicalGapDays: number;
    silentDays: number;
    lateBy: number;
    lastOrder: string;
    expectedBy: string;
    yearSpend: number;
  }[];
  valueAtRisk: number;
  /** Every repeat customer's days since last order (up to 180) and last-year spend, for the rhythm chart. */
  spread: { silentDays: number; yearSpend: number; zone: 'active' | 'slipping' | 'lost' }[];
}

export function earlyWarning(ds: Dataset): EarlyWarning {
  const orders = ordersOf(ds);
  const rule = `A repeat customer (${RULE.minOrders}+ order days) with no order for ${RULE.minSilentDays}–${RULE.maxSilentDays} days: past when most regulars reorder, before they count as lost.`;
  const end = endOf(ds);
  const empty = (reason: string): EarlyWarning => ({
    ok: false,
    reason,
    asOf: end ? isoDay(end - DAY) : '',
    rule,
    backtest: null,
    customers: [],
    valueAtRisk: 0,
    spread: [],
  });
  if (!orders.length)
    return empty('Needs dates and customer IDs on sales to spot customers who are slipping away.');
  const span = (end - orders[0].t) / DAY;
  if (span < 180)
    return empty(
      `Needs about 6 months of orders to learn each customer's rhythm; this data covers ${Math.round(span)} days.`,
    );

  // Replay the rule 90 days before the end, using only earlier orders, and see who really came back.
  const t0 = end - RULE.testWindowDays * DAY;
  const past = lateAt(orders, t0);
  const cameBack = new Set(orders.filter((o) => o.t >= t0 && o.t < end).map((o) => o.customer));
  const flaggedSet = new Set(past.late.map((c) => c.customer));
  const others = past.all.filter((c) => !flaggedSet.has(c.customer));
  const fAway = past.late.filter((c) => !cameBack.has(c.customer)).length,
    oAway = others.filter((c) => !cameBack.has(c.customer)).length;
  const test =
    past.late.length && others.length ? propTest(fAway, past.late.length, oAway, others.length) : null;

  const now = lateAt(orders, end);
  const customers = now.late
    .sort((a, b) => b.yearSpend - a.yearSpend)
    .map((c) => ({
      customer: c.customer,
      orders: c.orders,
      typicalGapDays: Math.round(c.typicalGap),
      silentDays: c.silent,
      lateBy: Math.round(c.silent - c.typicalGap),
      lastOrder: isoDay(c.last),
      expectedBy: isoDay(c.last + c.typicalGap * DAY),
      yearSpend: round2(c.yearSpend),
    }));
  return {
    ok: true,
    asOf: isoDay(end - DAY),
    rule,
    backtest: {
      asOf: isoDay(t0),
      windowDays: RULE.testWindowDays,
      flagged: past.late.length,
      flaggedStayedAway: fAway,
      others: others.length,
      othersStayedAway: oAway,
      p: test ? Math.round(test.pGreater * 10000) / 10000 : null,
      method: test ? `${test.method} (one-sided)` : 'Not enough customers to test',
    },
    customers,
    valueAtRisk: round2(customers.reduce((s, c) => s + c.yearSpend, 0)),
    spread: now.everyone
      .filter((c) => c.silent <= 180)
      .sort((a, b) => b.yearSpend - a.yearSpend)
      .slice(0, 800)
      .map((c) => ({
        silentDays: c.silent,
        yearSpend: round2(c.yearSpend),
        zone: c.silent > RULE.maxSilentDays ? 'lost' : c.silent >= RULE.minSilentDays ? 'slipping' : 'active',
      })),
  };
}

export interface WinBack {
  ok: boolean;
  reason?: string;
  cutoff: string;
  /** The last day of data the list was read from. */
  asOf?: string;
  customers: {
    customer: string;
    email: string | null;
    orders: number;
    spend: number;
    lastOrder: string;
    daysSilent: number;
    /** Distinct days with an order in the spending year. */
    orderDays?: number;
    /** Median days between those order days; null with a single order day. */
    typicalGapDays?: number | null;
    /** This customer's share of the list total, in %. */
    share?: number;
    topProducts: string[];
    message: string;
  }[];
  total: number;
}

/**
 * The best customers who went quiet, ready to contact: same definition as the finding (top 10% by spend in the year
 * before the last 90 days, 3+ orders in that year, no order in the last 90 days), plus what they used to buy and a
 * plain draft message. Nothing is sent from here.
 */
export function winBackList(ds: Dataset, shopName = 'our shop'): WinBack {
  const orders = ordersOf(ds);
  if (!orders.length)
    return {
      ok: false,
      reason: 'Needs dates and customer IDs on sales.',
      cutoff: '',
      customers: [],
      total: 0,
    };
  const end = endOf(ds);
  const cutoff = end - 90 * DAY,
    yearStart = cutoff - 365 * DAY;
  if (cutoff - orders[0].t < 60 * DAY)
    return {
      ok: false,
      reason: 'Needs at least 5 months of history (2 before the last 90 days).',
      cutoff: isoDay(cutoff),
      customers: [],
      total: 0,
    };
  const prior = new Map<
    string,
    { rev: number; n: number; last: number; products: Map<string, number>; days: number[] }
  >();
  for (const o of orders) {
    const e = prior.get(o.customer) ?? {
      rev: 0,
      n: 0,
      last: 0,
      products: new Map<string, number>(),
      days: [] as number[],
    };
    if (o.t >= yearStart && o.t < cutoff) {
      // Order rhythm is read from the same year as the spend (as in scripts/validate_lapsed.py).
      const d = Math.floor(o.t / DAY);
      if (e.days[e.days.length - 1] !== d) e.days.push(d);
      e.rev += o.total;
      e.n++;
      for (const p of o.products) e.products.set(p, (e.products.get(p) ?? 0) + 1);
    }
    e.last = Math.max(e.last, o.t);
    prior.set(o.customer, e);
  }
  const ranked = [...prior].filter(([, e]) => e.rev > 0).sort((a, b) => b[1].rev - a[1].rev);
  const best = ranked.slice(0, Math.max(10, Math.ceil(ranked.length * 0.1)));
  const lapsed = best.filter(([, e]) => e.n >= 3 && e.last < cutoff);
  const customers = lapsed.map(([c, e]) => {
    const topProducts = [...e.products.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p]) => p);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : null;
    const gaps = e.days.slice(1).map((d, i) => d - e.days[i]);
    const fav = topProducts[0] ? topProducts[0].toLowerCase() : 'your usual order';
    return {
      customer: c,
      email,
      orders: e.n,
      spend: round2(e.rev),
      lastOrder: isoDay(e.last),
      daysSilent: Math.floor((end - DAY - e.last) / DAY),
      orderDays: e.days.length,
      typicalGapDays: gaps.length ? roundHalfEven(median(gaps)) : null,
      topProducts,
      message:
        `Hi there,\n\nWe noticed it's been a while since your last order with ${shopName}, and we wanted to say thank you ` +
        `for being one of our best customers. If anything about your last order wasn't right, just reply and tell us.\n\n` +
        `Your ${fav} is still here whenever you need it.\n\nThank you,\n${shopName}`,
    };
  });
  const total = round2(customers.reduce((s, c) => s + c.spend, 0));
  return {
    ok: true,
    cutoff: isoDay(cutoff),
    asOf: isoDay(end - DAY),
    customers: customers.map((c) => ({ ...c, share: total ? round2((c.spend / total) * 100) : 0 })),
    total,
  };
}

/** The rows dated before `asOf` (YYYY-MM-DD): the data as it would have looked on that day. Returns and the
 * cleaning report are kept for those rows only, so a replay never sees anything from after its own date. */
export function sliceBefore(ds: Dataset, asOf: string): Dataset {
  const fm = detectFields(ds);
  const t = parseDay(asOf);
  if (!fm.date || !Number.isFinite(t)) return ds;
  const rows = ds.rows.filter((r: Row) => toMs(r[fm.date!]) < t);
  return { ...ds, rows, prep: ds.prep ? { ...ds.prep, scope: 'filtered' as const } : ds.prep };
}

/** A real calendar day in YYYY-MM-DD (rejects 2025-02-30), as UTC midnight ms, or NaN. */
export function parseDay(d: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return NaN;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) && isoDay(t) === d ? t : NaN;
}

export type FollowOutcome = 'reordered' | 'no-order-seen' | 'not-found';
export interface FollowUpAccount {
  customer: string;
  /** Found anywhere in the newer data (matched by the exact customer ID string, never by a similar name). */
  found: boolean;
  outcome: FollowOutcome;
  lastBefore: string | null;
  /** Orders dated on or after the list date. Returns excluded. */
  ordersAfter: number;
  salesAfter: number;
  firstOrderAfter: string | null;
  /** The owner's recorded contact day, if any. */
  contactedOn: string | null;
  /** Orders on days strictly after the contact day (sales data has dates, not times). */
  ordersAfterContact: number;
  salesAfterContact: number;
  /** Orders on the contact day itself: before or after the contact can't be told apart. */
  sameDayOrders: number;
}
export interface Coverage {
  from: string;
  to: string;
  /** Longest run of calendar days in the window with no rows at all (any customer). */
  longestGapDays: number;
  gapFrom: string | null;
  gapTo: string | null;
  /** True when the gap is long enough that "no order seen" may just be missing data. */
  thin: boolean;
}
export interface FollowUp {
  ok: boolean;
  reason?: string;
  /** The day the list was made: orders on or after it count as "ordered since the list". */
  since: string;
  /** The last day in the newer data. */
  dataEnd: string;
  daysObserved: number;
  accounts: FollowUpAccount[];
  matched: number;
  unmatched: string[];
  orderedAgain: number;
  salesAfter: number;
  /** Customers with a contact day: how many ordered on a later day, and what they spent then. */
  contacted: { customers: number; orderedAfter: number; salesAfter: number; sameDay: number };
  /** Matched customers with no contact day: how many ordered since the list. */
  notContacted: { customers: number; orderedSince: number };
  coverage: Coverage | null;
  /** Repeat customers (2+ orders before the date) not on the list who ordered in the same window. Context only. */
  baseline: { customers: number; orderedAgain: number } | null;
  note: string;
}

/** The longest stretch of days between `from` and `to` (inclusive) with no rows at all. */
function gaps(ds: Dataset, from: number, to: number): Coverage {
  const fm = detectFields(ds);
  const days = new Set<number>();
  for (const r of ds.rows as Row[]) {
    const t = toMs(r[fm.date!]);
    if (t >= from && t <= to) days.add(Math.floor(t / DAY));
  }
  let best = 0,
    bestAt = -1,
    run = 0;
  for (let d = Math.floor(from / DAY); d <= Math.floor(to / DAY); d++) {
    if (days.has(d)) run = 0;
    else if (++run > best) {
      best = run;
      bestAt = d;
    }
  }
  return {
    from: isoDay(from),
    to: isoDay(to),
    longestGapDays: best,
    gapFrom: best ? isoDay((bestAt - best + 1) * DAY) : null,
    gapTo: best ? isoDay(bestAt * DAY) : null,
    thin: best >= 21,
  };
}

/**
 * Which of the listed customers ordered again, read from this data. Two clocks: "since the list" (orders on or
 * after `since`) and "after contact" (orders on days strictly after each customer's own contact day; same-day
 * orders are counted apart because the data has no times). IDs are deduplicated and matched exactly as strings.
 */
export function followUpCheck(
  ds: Dataset,
  since: string,
  rawIds: string[],
  contacts: Record<string, string> = {},
): FollowUp {
  const ids = [...new Set(rawIds.map(String))];
  const orders = ordersOf(ds);
  const t0 = parseDay(since);
  const end = endOf(ds);
  const note =
    'Counts real orders in this data. It shows who ordered after the list was made or after a recorded contact, not that contacting them caused it.';
  const base = {
    since,
    dataEnd: end ? isoDay(end - DAY) : '',
    daysObserved: end && Number.isFinite(t0) ? Math.max(0, Math.round((end - t0) / DAY)) : 0,
    note,
  };
  const fail = (reason: string): FollowUp => ({
    ok: false,
    reason,
    ...base,
    accounts: [],
    matched: 0,
    unmatched: ids,
    orderedAgain: 0,
    salesAfter: 0,
    contacted: { customers: 0, orderedAfter: 0, salesAfter: 0, sameDay: 0 },
    notContacted: { customers: 0, orderedSince: 0 },
    coverage: null,
    baseline: null,
  });
  if (!orders.length) return fail('This data has no dated sales with customer IDs to check against.');
  if (!Number.isFinite(t0)) return fail('The list date is not a real calendar date.');
  if (end <= t0)
    return fail(
      `This data ends on ${base.dataEnd}, before the list was made on ${since}. Upload a newer export to see who ordered again.`,
    );
  const by = new Map<string, Order[]>();
  for (const o of orders) {
    const l = by.get(o.customer) ?? [];
    l.push(o);
    by.set(o.customer, l);
  }
  for (const l of by.values()) l.sort((a, b) => a.t - b.t);
  const want = new Set(ids);
  const accounts: FollowUpAccount[] = ids.map((customer) => {
    const cRaw = contacts[customer];
    const tc = cRaw ? parseDay(cRaw) : NaN;
    const contactedOn = Number.isFinite(tc) ? cRaw : null;
    const l = by.get(customer);
    const blank = {
      customer,
      lastBefore: null,
      ordersAfter: 0,
      salesAfter: 0,
      firstOrderAfter: null,
      contactedOn,
      ordersAfterContact: 0,
      salesAfterContact: 0,
      sameDayOrders: 0,
    };
    if (!l) return { ...blank, found: false, outcome: 'not-found' as const };
    const before = l.filter((o) => o.t < t0),
      after = l.filter((o) => o.t >= t0);
    const dc = Number.isFinite(tc) ? Math.floor(tc / DAY) : null;
    const afterC = dc === null ? [] : l.filter((o) => Math.floor(o.t / DAY) > dc);
    const same = dc === null ? 0 : l.filter((o) => Math.floor(o.t / DAY) === dc).length;
    return {
      ...blank,
      found: true,
      outcome: after.length ? ('reordered' as const) : ('no-order-seen' as const),
      lastBefore: before.length ? isoDay(before[before.length - 1].t) : null,
      ordersAfter: after.length,
      salesAfter: round2(after.reduce((s, o) => s + o.total, 0)),
      firstOrderAfter: after.length ? isoDay(after[0].t) : null,
      ordersAfterContact: afterC.length,
      salesAfterContact: round2(afterC.reduce((s, o) => s + o.total, 0)),
      sameDayOrders: same,
    };
  });
  let others = 0,
    othersBack = 0;
  for (const [c, l] of by) {
    if (want.has(c)) continue;
    if (l.filter((o) => o.t < t0).length < 2) continue;
    others++;
    if (l.some((o) => o.t >= t0)) othersBack++;
  }
  const matched = accounts.filter((a) => a.found);
  const withC = matched.filter((a) => a.contactedOn),
    noC = matched.filter((a) => !a.contactedOn);
  return {
    ok: true,
    ...base,
    accounts,
    matched: matched.length,
    unmatched: accounts.filter((a) => !a.found).map((a) => a.customer),
    orderedAgain: matched.filter((a) => a.ordersAfter > 0).length,
    salesAfter: round2(matched.reduce((s, a) => s + a.salesAfter, 0)),
    contacted: {
      customers: withC.length,
      orderedAfter: withC.filter((a) => a.ordersAfterContact > 0).length,
      salesAfter: round2(withC.reduce((s, a) => s + a.salesAfterContact, 0)),
      sameDay: withC.filter((a) => a.sameDayOrders > 0 && !a.ordersAfterContact).length,
    },
    notContacted: { customers: noC.length, orderedSince: noC.filter((a) => a.ordersAfter > 0).length },
    coverage: gaps(ds, t0, end - DAY),
    baseline: others ? { customers: others, orderedAgain: othersBack } : null,
    note,
  };
}

export interface QuietReplay {
  asOf: string;
  windowDays: number;
  flagged: number;
  flaggedStayedAway: number;
  /** Other top customers (same top-10%, 3+ orders rule) who were still ordering on that date. */
  others: number;
  othersStayedAway: number;
  /** One-sided Fisher exact test: flagged customers stayed away more often. */
  p: number;
}
export interface QuietBacktest {
  ok: boolean;
  reason?: string;
  rule: string;
  replays: QuietReplay[];
}

/**
 * The quiet-top-customer rule (the win-back list and its finding) replayed at two earlier dates, 6 and 9 months
 * before the data ends, using only orders before each date. Outcome: who placed no order in the next 180 days,
 * flagged customers vs the other top customers who were still ordering. Mirrors scripts/validate_lapsed.py.
 */
export function quietRuleBacktest(ds: Dataset): QuietBacktest {
  const rule =
    'Top 10% by spend (at least 10) in the year before the last 90 days, 3+ orders that year, no order in the last 90 days.';
  const orders = ordersOf(ds);
  const end = endOf(ds);
  if (!orders.length) return { ok: false, reason: 'Needs dated sales with customer IDs.', rule, replays: [] };
  const replays: QuietReplay[] = [];
  for (const back of [275, 183]) {
    const t = end - back * DAY;
    const cutoff = t - 90 * DAY,
      start = cutoff - 365 * DAY;
    if (orders[0].t > start) continue;
    const prior = new Map<string, { rev: number; n: number }>(),
      last = new Map<string, number>();
    for (const o of orders) {
      if (o.t >= t) continue;
      if (o.t >= start && o.t < cutoff) {
        const e = prior.get(o.customer) ?? { rev: 0, n: 0 };
        e.rev += o.total;
        e.n++;
        prior.set(o.customer, e);
      }
      last.set(o.customer, Math.max(last.get(o.customer) ?? o.t, o.t));
    }
    const ranked = [...prior]
      .filter(([, e]) => e.rev > 0)
      .sort((a, b) => b[1].rev - a[1].rev || (a[0] < b[0] ? -1 : 1));
    const best = ranked.slice(0, Math.max(10, Math.ceil(ranked.length / 10)));
    const lapsed = best.filter(([c, e]) => e.n >= 3 && last.get(c)! < cutoff);
    const steady = best.filter(([c, e]) => e.n >= 3 && last.get(c)! >= cutoff);
    const back180 = new Set(orders.filter((o) => o.t >= t && o.t < t + 180 * DAY).map((o) => o.customer));
    const away = (g: typeof best) => g.filter(([c]) => !back180.has(c)).length;
    const a1 = away(lapsed),
      a2 = away(steady);
    if (!lapsed.length || !steady.length) continue;
    replays.push({
      asOf: isoDay(t),
      windowDays: 180,
      flagged: lapsed.length,
      flaggedStayedAway: a1,
      others: steady.length,
      othersStayedAway: a2,
      p: fisherGreater(a1, lapsed.length, a2, steady.length),
    });
  }
  return replays.length
    ? { ok: true, rule, replays }
    : { ok: false, reason: 'Needs about two years of orders to replay the rule on the past.', rule, replays };
}
