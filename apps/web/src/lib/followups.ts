import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../auth';

/**
 * Follow-up lists: the customers an owner chose to contact, what they did, and the last recheck. Signed-in users
 * keep lists in their own Supabase rows (row-level security: only they can read or change them); guests keep them
 * in this browser. Stored: customer IDs (and emails when the export had them), amounts already shown on screen,
 * statuses, contact days and notes. Never raw sales rows.
 *
 * Snapshot rules (see `applyEdit`, tested in tests/followup-rules.test.ts):
 * - A list's date, data name, currency, rule, replay flag and each customer's selection figures are frozen when the
 *   list is made. Later uploads and rechecks never rewrite them.
 * - Only status, contact day and note change per customer, plus the latest recheck for the list.
 * - Customer IDs are unique within a list (duplicates dropped when the list is made).
 * - Setting a customer back from Contacted clears their contact day; the day can be corrected while Contacted.
 * - A practice run (historical replay) stays marked as one forever and can't record contacts.
 */
export type Status = 'todo' | 'contacted' | 'skipped';
export interface FollowAccount {
  customer: string;
  email: string | null;
  spend: number;
  share: number;
  orders: number;
  typicalGapDays: number | null;
  daysSilent: number;
  lastOrder: string;
  status: Status;
  contactedOn: string | null;
  note: string;
  /** Why the owner chose not to contact this customer (their judgement overrides the rule; kept as evidence). */
  skipReason?: SkipReason | null;
}
/** The owner's own reason (what they believe, not something BlindSpot checked). Optional. */
export type SkipReason = 'notnow' | 'seasonal' | 'closed' | 'switched' | 'other';
export const SKIP_REASONS: { id: SkipReason; label: string }[] = [
  { id: 'notnow', label: 'Not now' },
  { id: 'seasonal', label: 'Seasonal buyer' },
  { id: 'closed', label: 'Closed or moved' },
  { id: 'switched', label: 'Buys elsewhere' },
  { id: 'other', label: 'Other reason' },
];
export interface CheckAccount {
  customer: string;
  found: boolean;
  outcome: 'reordered' | 'no-order-seen' | 'not-found';
  ordersAfter: number;
  salesAfter: number;
  firstOrderAfter: string | null;
  contactedOn: string | null;
  ordersAfterContact: number;
  salesAfterContact: number;
  sameDayOrders: number;
}
export interface FollowCheck {
  at: string;
  /** The data the recheck read (its name), so a check is never confused with another shop's. */
  checkedAgainst: string;
  dataEnd: string;
  daysObserved: number;
  matched: number;
  unmatched: string[];
  orderedAgain: number;
  salesAfter: number;
  contacted: { customers: number; orderedAfter: number; salesAfter: number; sameDay: number };
  notContacted: { customers: number; orderedSince: number };
  coverage: {
    from: string;
    to: string;
    longestGapDays: number;
    gapFrom: string | null;
    gapTo: string | null;
    thin: boolean;
  } | null;
  baseline: { customers: number; orderedAgain: number } | null;
  accounts: CheckAccount[];
}
export interface FollowMeta {
  /** The shop the owner says this list belongs to. Customer IDs are only compared within one shop. */
  shop?: string;
  /** The last day of data the list was read from. */
  dataEnd: string;
  currency: string;
  rule: string;
  total: number;
}
export interface FollowList {
  id: string;
  name: string;
  /** The day the list was made: orders on or after it count as "ordered since the list". */
  since: string;
  source: string;
  replay: boolean;
  meta: FollowMeta;
  accounts: FollowAccount[];
  last_check: FollowCheck | null;
  created_at: string;
  updated_at: string;
}

/** Merge an edit into a saved list, keeping every frozen field from the original (see the rules above). */
export function applyEdit(orig: FollowList, next: FollowList): FollowList {
  const edits = new Map(next.accounts.map((a) => [a.customer, a]));
  const accounts = orig.accounts.map((a) => {
    const e = edits.get(a.customer);
    if (!e) return a;
    const status: Status = orig.replay && e.status === 'contacted' ? a.status : e.status;
    const contactedOn =
      status === 'contacted' ? (validDay(e.contactedOn) ? e.contactedOn : (a.contactedOn ?? null)) : null;
    const skipReason = status === 'skipped' ? (e.skipReason ?? a.skipReason ?? null) : null;
    return { ...a, status, contactedOn, skipReason, note: (e.note ?? '').slice(0, 500) };
  });
  // A recheck answers for the contacts as they were. If who was contacted, or when, changes, it's out of date.
  const moved = accounts.some(
    (a, i) => a.status !== orig.accounts[i].status || a.contactedOn !== orig.accounts[i].contactedOn,
  );
  return { ...orig, name: next.name.slice(0, 120), last_check: moved ? null : next.last_check, accounts };
}

/** Which shop the owner said each loaded export belongs to (dataset id → shop), kept in this browser. */
const ASSIGN = 'blindspot.shop-of-export.v1';
export function assignedShop(datasetId: string | null | undefined): string | null {
  if (!datasetId) return null;
  try {
    return (JSON.parse(localStorage.getItem(ASSIGN) ?? '{}') as Record<string, string>)[datasetId] ?? null;
  } catch {
    return null;
  }
}
export function assignShop(datasetId: string | null | undefined, shop: string) {
  if (!datasetId) return;
  try {
    const m = JSON.parse(localStorage.getItem(ASSIGN) ?? '{}') as Record<string, string>;
    m[datasetId] = shop;
    localStorage.setItem(ASSIGN, JSON.stringify(m));
  } catch {
    /* storage blocked: the owner is simply asked again next time */
  }
}
export const validDay = (d: string | null | undefined): d is string => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
};
/** Drop duplicate IDs, keeping the first. */
export const uniqueAccounts = (a: FollowAccount[]) => {
  const seen = new Set<string>();
  return a.filter((x) => (seen.has(x.customer) ? false : (seen.add(x.customer), true)));
};

const KEY = 'blindspot.followups.v1';
const readLocal = (): FollowList[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v)
      ? v.map((l) => ({ meta: { dataEnd: '', currency: '', rule: '', total: 0 }, ...l }))
      : [];
  } catch {
    return [];
  }
};
const writeLocal = (l: FollowList[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* storage blocked (private window): the list still works for this visit */
  }
};
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useFollowUps() {
  const { user, ready } = useAuth();
  const [lists, setLists] = useState<FollowList[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const where = user ? 'account' : 'browser';
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef<FollowList[]>([]);
  latest.current = lists;

  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLoaded(false);
    setError(null);
    latest.current = [];
    setLists([]);
    (async () => {
      if (!user) {
        setLists(readLocal());
      } else {
        const { data, error } = await supabase
          .from('follow_up_lists')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);
        if (!live) return;
        if (error) setError('Could not load your saved lists. Changes stay on this page for now.');
        setLists(((data as FollowList[]) ?? []).map((l) => ({ ...l, meta: l.meta ?? ({} as FollowMeta) })));
      }
      if (live) setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, [ready, user?.id]);

  const persist = useCallback(
    (l: FollowList, immediate = false) => {
      if (!user) {
        writeLocal(latest.current.map((x) => (x.id === l.id ? l : x)));
        return;
      }
      // Notes are typed a letter at a time: save to the account once typing pauses.
      const save = async () => {
        const { error } = await supabase.from('follow_up_lists').upsert({
          id: l.id,
          name: l.name,
          since: l.since,
          source: l.source,
          replay: l.replay,
          meta: l.meta,
          accounts: l.accounts,
          last_check: l.last_check,
          updated_at: l.updated_at,
        });
        setError(error ? 'Saving to your account failed. Your changes are still on this page.' : null);
      };
      clearTimeout(pending.current.get(l.id));
      if (immediate) void save();
      else pending.current.set(l.id, setTimeout(save, 600));
    },
    [user?.id],
  );

  const create = useCallback(
    (l: Omit<FollowList, 'id' | 'created_at' | 'updated_at' | 'last_check'>) => {
      const now = new Date().toISOString();
      const full: FollowList = {
        ...l,
        accounts: uniqueAccounts(l.accounts),
        id: uid(),
        created_at: now,
        updated_at: now,
        last_check: null,
      };
      latest.current = [full, ...latest.current];
      setLists(latest.current);
      persist(full, true);
      return full;
    },
    [persist],
  );
  const update = useCallback(
    (l: FollowList, immediate = false) => {
      const orig = latest.current.find((x) => x.id === l.id);
      if (!orig) return;
      const next = { ...applyEdit(orig, l), updated_at: new Date().toISOString() };
      latest.current = latest.current.map((x) => (x.id === l.id ? next : x));
      setLists(latest.current);
      persist(next, immediate);
    },
    [persist],
  );
  const remove = useCallback(
    async (id: string) => {
      latest.current = latest.current.filter((x) => x.id !== id);
      setLists(latest.current);
      if (!user) writeLocal(latest.current);
      else await supabase.from('follow_up_lists').delete().eq('id', id);
    },
    [user?.id],
  );
  /** Signed in: how many guest lists sit in this browser (never shown in the account unless moved on purpose). */
  const browserCount = user ? readLocal().length : 0;
  /** Signed in: copy this browser's guest lists into the account, then remove them from the browser. */
  const moveBrowserLists = useCallback(async () => {
    if (!user) return 'Log in first.';
    const local = readLocal();
    if (!local.length) return null;
    const { error } = await supabase.from('follow_up_lists').insert(
      local.map((l) => ({
        id: l.id,
        name: l.name,
        since: l.since,
        source: l.source,
        replay: l.replay,
        meta: l.meta,
        accounts: l.accounts,
        last_check: l.last_check,
      })),
    );
    if (error) return 'Moving the lists failed. They are still in this browser.';
    writeLocal([]);
    latest.current = [...local, ...latest.current];
    setLists(latest.current);
    return null;
  }, [user?.id]);
  /** Guests only: forget every list stored in this browser (shared computers). */
  const clearBrowser = useCallback(() => {
    if (user) return;
    latest.current = [];
    setLists([]);
    writeLocal([]);
  }, [user?.id]);
  return {
    lists,
    loaded,
    error,
    where,
    create,
    update,
    remove,
    clearBrowser,
    browserCount,
    moveBrowserLists,
  };
}
