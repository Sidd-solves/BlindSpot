import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../auth';

/**
 * Follow-up lists: the customers an owner chose to contact, what they did, and the last recheck. Signed-in users
 * keep lists in their own Supabase rows (row-level security: only they can read them); guests keep them in this
 * browser. Only customer IDs, amounts already shown on screen, statuses and notes are stored, never raw sales rows.
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
}
export interface FollowCheck {
  at: string;
  dataEnd: string;
  daysObserved: number;
  matched: number;
  unmatched: string[];
  orderedAgain: number;
  salesAfter: number;
  baseline: { customers: number; orderedAgain: number } | null;
  accounts: {
    customer: string;
    found: boolean;
    ordersAfter: number;
    salesAfter: number;
    firstOrderAfter: string | null;
  }[];
}
export interface FollowList {
  id: string;
  name: string;
  /** The day the list was made: orders on or after it count as "ordered again". */
  since: string;
  source: string;
  replay: boolean;
  accounts: FollowAccount[];
  last_check: FollowCheck | null;
  created_at: string;
  updated_at: string;
}

const KEY = 'blindspot.followups.v1';
const readLocal = (): FollowList[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
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

  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLoaded(false);
    (async () => {
      if (!user) {
        setLists(readLocal());
      } else {
        const { data, error } = await supabase
          .from('follow_up_lists')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(30);
        if (!live) return;
        if (error) setError('Could not load your saved lists. Changes stay on this page for now.');
        setLists((data as FollowList[]) ?? []);
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
        setLists((cur) => {
          const next = [l, ...cur.filter((x) => x.id !== l.id)];
          writeLocal(next);
          return next;
        });
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
      const full: FollowList = { ...l, id: uid(), created_at: now, updated_at: now, last_check: null };
      setLists((cur) => [full, ...cur]);
      persist(full, true);
      return full;
    },
    [persist],
  );
  const update = useCallback(
    (l: FollowList, immediate = false) => {
      const next = { ...l, updated_at: new Date().toISOString() };
      setLists((cur) => cur.map((x) => (x.id === l.id ? next : x)));
      persist(next, immediate);
    },
    [persist],
  );
  const remove = useCallback(
    async (id: string) => {
      setLists((cur) => {
        const next = cur.filter((x) => x.id !== id);
        if (!user) writeLocal(next);
        return next;
      });
      if (user) await supabase.from('follow_up_lists').delete().eq('id', id);
    },
    [user?.id],
  );
  return { lists, loaded, error, where, create, update, remove };
}
