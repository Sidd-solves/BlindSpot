import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CalendarCheck,
  Check,
  ChevronDown,
  CircleDashed,
  Download,
  History,
  ListChecks,
  Loader2,
  PhoneCall,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { tool, usd } from '../api';
import { useStore } from '../store';
import { useAuth } from '../auth';
import { useTool } from './useTool';
import { AiWinback } from './AiWinback';
import { Card, CountUp, Dropdown } from './ui';
import {
  assignShop,
  assignedShop,
  useFollowUps,
  SKIP_REASONS,
  type CheckAccount,
  type FollowAccount,
  type FollowCheck,
  type FollowList,
  type Status,
} from '../lib/followups';

type WB = {
  ok: boolean;
  reason?: string;
  cutoff: string;
  asOf?: string;
  customers: {
    customer: string;
    email: string | null;
    orders: number;
    spend: number;
    lastOrder: string;
    daysSilent: number;
    orderDays?: number;
    typicalGapDays?: number | null;
    share?: number;
    topProducts: string[];
    message: string;
  }[];
  total: number;
  backtest?: {
    ok: boolean;
    reason?: string;
    rule: string;
    replays: {
      asOf: string;
      windowDays: number;
      flagged: number;
      flaggedStayedAway: number;
      others: number;
      othersStayedAway: number;
      p: number;
    }[];
  };
};
type FU = Omit<FollowCheck, 'at' | 'checkedAgainst'> & {
  ok: boolean;
  reason?: string;
  since: string;
  note: string;
};
const RULE =
  'Top 10% by spend in the year before the last 90 days, 3+ orders that year, no order in the last 90 days.';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(Date.parse(`${d}T00:00:00Z`) + n * DAY);
const nice = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
const today = () => iso(Date.now());
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const STEPS = [
  { id: 'find', label: 'Find', icon: Search, c: 'var(--violet)' },
  { id: 'decide', label: 'Decide', icon: ListChecks, c: 'var(--sky)' },
  { id: 'act', label: 'Act', icon: PhoneCall, c: 'var(--amber)' },
  { id: 'recheck', label: 'Recheck', icon: RefreshCcw, c: 'var(--emerald)' },
] as const;
const STATUS: Record<Status, { label: string; c: string }> = {
  todo: { label: 'To do', c: 'var(--faint)' },
  contacted: { label: 'Contacted', c: 'var(--amber)' },
  skipped: { label: 'Skip', c: 'var(--muted)' },
};
const REPLAY = [
  { days: 100, label: '100 days back' },
  { days: 180, label: '6 months back' },
  { days: 270, label: '9 months back' },
];

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The four-step loop on top of Customer Radar: find quiet customers, pick who to contact, log it, then recheck. */
export function FollowUp() {
  const { version, dataset } = useStore();
  const { user, profile } = useAuth();
  const fu = useFollowUps();
  // "?practice=1" (from the site's "Try the loop" button) opens straight into the replay on past data.
  const [mode, setMode] = useState<'now' | 'replay'>(() =>
    /[?&]practice=1/.test(location.hash) ? 'replay' : 'now',
  );
  const [back, setBack] = useState(100);
  const [shop, setShop] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [checkReason, setCheckReason] = useState<string | null>(null);
  // A recheck against data with a different name waits for the owner to confirm it's the same shop.
  const [confirmOther, setConfirmOther] = useState(false);
  const shopName = shop.trim() || 'our shop';
  const [moveMsg, setMoveMsg] = useState<string | null>(null);
  // Nothing from a previous account stays open after switching accounts or signing out.
  useEffect(() => setActiveId(null), [user?.id]);

  const nowQ = useTool<WB>('win-back-list', { shopName: 'our shop' }, [version]);
  const end = nowQ.data?.asOf;
  const asOf = mode === 'replay' && end ? addDays(end, -back + 1) : undefined;
  const repQ = useTool<WB>('win-back-list', { shopName: 'our shop', asOf }, [version, asOf], !!asOf);
  const wb = mode === 'replay' ? repQ.data : nowQ.data;
  const since = mode === 'replay' ? asOf : end ? addDays(end, 1) : undefined;

  const active = fu.lists.find((l) => l.id === activeId) ?? null;
  // Pick the most recent list once lists load, so a returning owner lands on their work.
  useEffect(() => {
    // Only lists made from the data loaded now: another shop's customer IDs mean nothing here.
    const mine = fu.lists.find((l) => l.source === dataset?.name && !l.replay);
    if (fu.loaded && activeId === null && mine && mode === 'now') setActiveId(mine.id);
  }, [fu.loaded, dataset?.name]);
  // A new list (or mode) starts with nobody ticked: the owner decides, the tool doesn't pre-choose.
  useEffect(() => setPicked(new Set()), [wb]);
  useEffect(() => {
    setCheckReason(null);
    setCheckErr(null);
    setConfirmOther(false);
  }, [activeId, version]);

  const step = !active ? (picked.size ? 1 : 0) : active.last_check ? 3 : 2;
  const contacted = active?.accounts.filter((a) => a.status === 'contacted').length ?? 0;
  const top = wb?.customers.reduce((m, c) => Math.max(m, c.share ?? 0), 0) ?? 0;
  const topC = wb?.customers.find((c) => (c.share ?? 0) === top);

  const shopOf = () => profile?.shop_name?.trim() || dataset?.name || 'My shop';
  const start = () => {
    if (!wb || !since) return;
    const accounts: FollowAccount[] = wb.customers
      .filter((c) => picked.has(c.customer))
      .map((c) => ({
        customer: c.customer,
        email: c.email,
        spend: c.spend,
        share: c.share ?? 0,
        orders: c.orders,
        typicalGapDays: c.typicalGapDays ?? null,
        daysSilent: c.daysSilent,
        lastOrder: c.lastOrder,
        status: 'todo',
        contactedOn: null,
        note: '',
      }));
    const l = fu.create({
      name: `${mode === 'replay' ? 'Practice run' : 'Follow-up'} · ${nice(since)}`,
      since,
      source: dataset?.name ?? 'Current data',
      replay: mode === 'replay',
      meta: {
        shop: shopOf(),
        dataEnd: wb.asOf ?? '',
        currency: dataset?.currency ?? '',
        rule: RULE,
        total: accounts.reduce((s, a) => s + a.spend, 0),
      },
      accounts,
    });
    // The owner made this list from this export, so the export belongs to that shop.
    if (mode === 'now') assignShop(dataset?.datasetId, l.meta.shop ?? '');
    setActiveId(l.id);
    setPicked(new Set());
  };
  const setAcc = (a: FollowAccount, patch: Partial<FollowAccount>, immediate = true) => {
    if (!active) return;
    fu.update(
      {
        ...active,
        accounts: active.accounts.map((x) => (x.customer === a.customer ? { ...x, ...patch } : x)),
      },
      immediate,
    );
  };
  const listShop = active?.meta?.shop || active?.source || '';
  // Identity is what the owner says, not the file name: two shops can both upload "orders.csv".
  const unassigned = !!active && !active.replay && assignedShop(dataset?.datasetId) !== listShop;
  const recheck = async (confirmed = false) => {
    if (!active) return;
    if (active.replay && dataset?.name !== active.source)
      return setCheckReason(
        `This practice run was made from ${active.source}. Load that data on Data Sources to replay it; it can't be checked against ${dataset?.name}.`,
      );
    if (unassigned && !confirmed) return setConfirmOther(true);
    if (confirmed) assignShop(dataset?.datasetId, listShop);
    setChecking(true);
    setCheckErr(null);
    setCheckReason(null);
    const contacts = Object.fromEntries(
      active.accounts
        .filter((a) => a.status === 'contacted' && a.contactedOn)
        .map((a) => [a.customer, a.contactedOn!]),
    );
    const r = await tool<FU>('follow-up-check', {
      since: active.since,
      customers: active.accounts.map((a) => a.customer),
      contacts,
    });
    setChecking(false);
    setConfirmOther(false);
    if (!r.ok || !r.data) return setCheckErr(r.error?.message ?? 'The recheck failed.');
    if (!r.data.ok) return setCheckReason(r.data.reason ?? 'Nothing to compare yet.');
    const d = r.data;
    fu.update(
      {
        ...active,
        last_check: {
          at: new Date().toISOString(),
          checkedAgainst: dataset?.name ?? '',
          dataEnd: d.dataEnd,
          daysObserved: d.daysObserved,
          matched: d.matched,
          unmatched: d.unmatched,
          orderedAgain: d.orderedAgain,
          salesAfter: d.salesAfter,
          contacted: d.contacted,
          notContacted: d.notContacted,
          coverage: d.coverage,
          baseline: d.baseline,
          accounts: d.accounts,
        },
      },
      true,
    );
  };

  const exportList = (l: FollowList) => {
    const out = new Map(l.last_check?.accounts.map((a) => [a.customer, a]) ?? []);
    download(`${l.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`, [
      [
        'Customer',
        'Email',
        'Spend in the year before going quiet',
        'Share of list %',
        'Order days',
        'Usual gap (days)',
        'Days silent',
        'Last order',
        'Status',
        'Contacted on',
        'Note',
        'Outcome since list',
        'Orders since list',
        'Sales since list (returns excluded)',
        'First order since list',
        'Orders on later days than contact',
        'Sales after contact',
        'Orders on the contact day (timing unknown)',
      ],
      ...l.accounts.map((a) => {
        const o = out.get(a.customer);
        return [
          a.customer,
          a.email,
          a.spend,
          a.share,
          a.orders,
          a.typicalGapDays,
          a.daysSilent,
          a.lastOrder,
          STATUS[a.status].label,
          a.contactedOn,
          a.note,
          o ? (!o.found ? 'ID not found in newer data' : o.ordersAfter ? 'Ordered' : 'No order seen') : '',
          o?.ordersAfter ?? '',
          o?.salesAfter ?? '',
          o?.firstOrderAfter ?? '',
          o?.contactedOn ? o.ordersAfterContact : '',
          o?.contactedOn ? o.salesAfterContact : '',
          o?.contactedOn ? o.sameDayOrders : '',
        ];
      }),
    ]);
  };

  return (
    <Card c="var(--violet)" className="lg:col-span-12" hover={false}>
      {/* Header: the loop, with progress */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg"
            style={{
              color: 'var(--violet)',
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--violet) 30%, transparent), color-mix(in srgb, var(--cyan) 12%, transparent))',
              boxShadow: '0 0 16px -4px var(--violet)',
            }}
          >
            <UserRoundCheck size={14} />
          </span>
          <h3 className="text-[13.5px] font-extrabold tracking-tight">
            Follow-up: who to contact, and who came back
          </h3>
        </div>
        <Stepper step={step} />
        <div className="ml-auto flex items-center gap-1.5">
          <SaveChip
            where={fu.where}
            error={fu.error}
            onClear={fu.lists.length ? fu.clearBrowser : undefined}
          />
          {fu.lists.length > 0 && (
            <Dropdown
              value={active ? [active.name] : []}
              options={fu.lists.map((l) => l.name)}
              onChange={(v) => setActiveId(fu.lists.find((l) => l.name === v[0])?.id ?? null)}
              placeholder="Select a saved list..."
              width={190}
            />
          )}
        </div>
      </div>

      {fu.where === 'account' && fu.browserCount > 0 && (
        <div
          className="mx-3.5 mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="min-w-0 flex-1">
            {fu.browserCount} list{fu.browserCount === 1 ? ' was' : 's were'} saved in this browser as a
            guest. They aren’t part of your account unless you move them.
            {moveMsg && <b> {moveMsg}</b>}
          </span>
          <button
            className="btn !h-7 text-[11.5px]"
            onClick={async () => setMoveMsg((await fu.moveBrowserLists()) ?? 'Moved.')}
          >
            Move them to my account
          </button>
        </div>
      )}
      <div className="grid gap-3 px-3.5 pb-3.5 lg:grid-cols-12">
        {/* LEFT: find + decide, or act on the open list */}
        <div className="min-w-0 lg:col-span-7">
          <AnimatePresence mode="popLayout" initial={false}>
            {!active ? (
              <motion.div
                key="find"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Seg
                    value={mode}
                    onChange={setMode}
                    options={[
                      { id: 'now', label: 'Latest data' },
                      { id: 'replay', label: 'Practice on past data' },
                    ]}
                  />
                  {mode === 'replay' && (
                    <Seg
                      value={String(back)}
                      onChange={(v) => setBack(Number(v))}
                      options={REPLAY.map((r) => ({ id: String(r.days), label: r.label }))}
                    />
                  )}
                </div>
                {mode === 'replay' && asOf && (
                  <div
                    className="tint mb-2 flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px]"
                    style={{ '--c': 'var(--sky)' } as CSSProperties}
                  >
                    <History size={13} className="mt-0.5 flex-none" style={{ color: 'var(--sky)' }} />
                    <span>
                      <b>Historical replay.</b> BlindSpot reads only the orders before <b>{nice(asOf)}</b>, as
                      if that were today. Recheck then reads the shop’s real later orders. Nobody was
                      contacted through BlindSpot back then, so this shows how the recheck works, not the
                      effect of an email.
                    </span>
                  </div>
                )}
                {!wb ? (
                  <Skeleton />
                ) : !wb.ok ? (
                  <div className="py-6 text-center text-[12px] text-[var(--muted)]">{wb.reason}</div>
                ) : (
                  <>
                    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[12px] text-[var(--muted)]">
                      <span>
                        <CountUp
                          value={wb.customers.length}
                          className="text-[20px] font-semibold text-[var(--text)]"
                        />{' '}
                        top customers with no order in 90 days
                      </span>
                      <span>
                        ·{' '}
                        <b className="text-[var(--text)]">
                          <CountUp value={wb.total} format={(n) => usd(n)} />
                        </b>{' '}
                        in the year before
                      </span>
                      <span className="text-[11px] text-[var(--faint)]">
                        as of {wb.asOf ? nice(wb.asOf) : ''}
                      </span>
                    </div>
                    {topC && top >= 30 && wb.customers.length >= 3 && (
                      <div
                        className="tint mb-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px]"
                        style={{ '--c': 'var(--amber)' } as CSSProperties}
                      >
                        <b>One account is {Math.round(top)}% of this total</b> ({topC.email ?? topC.customer},{' '}
                        {topC.orders} orders in the year). Check its history before reading the total as
                        typical.
                      </div>
                    )}
                    <div className="mb-1 grid grid-cols-[18px_minmax(0,1fr)_92px_74px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--faint)]">
                      <span />
                      <span>Customer · rhythm</span>
                      <span>Share of total</span>
                      <span className="text-right">Year before</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto pr-1">
                      {wb.customers.map((c, i) => {
                        const on = picked.has(c.customer);
                        return (
                          <motion.button
                            key={c.customer}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.03 * i }}
                            onClick={() => {
                              const n = new Set(picked);
                              if (on) n.delete(c.customer);
                              else n.add(c.customer);
                              setPicked(n);
                            }}
                            className="row-hover grid w-full grid-cols-[18px_minmax(0,1fr)_92px_74px] items-center gap-2 rounded-md px-1 py-1.5 text-left text-[12px]"
                            aria-pressed={on}
                          >
                            <Tick on={on} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{c.email ?? c.customer}</span>
                              <span className="block truncate text-[11px] text-[var(--faint)]">
                                {c.orders} orders in the year
                                {c.typicalGapDays ? ` · usually every ${c.typicalGapDays} days` : ''} · silent{' '}
                                {c.daysSilent} days
                              </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 flex-1 rounded-full bg-[var(--line)]">
                                <motion.span
                                  className="block h-1.5 rounded-full"
                                  style={{
                                    background: (c.share ?? 0) >= 30 ? 'var(--amber)' : 'var(--violet)',
                                  }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, c.share ?? 0)}%` }}
                                  transition={{ duration: 0.7, delay: 0.05 + 0.03 * i }}
                                />
                              </span>
                              <span className="mono w-8 text-right text-[11px] text-[var(--muted)]">
                                {Math.round(c.share ?? 0)}%
                              </span>
                            </span>
                            <span className="mono text-right font-semibold">{usd(c.spend, true)}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        className="btn !h-7 text-[11.5px]"
                        onClick={() =>
                          setPicked(
                            picked.size === wb.customers.length
                              ? new Set()
                              : new Set(wb.customers.map((c) => c.customer)),
                          )
                        }
                      >
                        {picked.size === wb.customers.length ? 'Clear' : 'Select all'}
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        disabled={!picked.size}
                        onClick={start}
                        className="btn btn-primary !h-7 text-[11.5px]"
                      >
                        <ListChecks size={12} />
                        {picked.size ? `Start a list with ${picked.size}` : 'Tick who to contact'}
                      </motion.button>
                      <span className="text-[11px] text-[var(--faint)]">
                        Same rule as the finding: top 10% by spend, 3+ orders, no order in 90 days.
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={`act-${active.id}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button className="btn !h-7 text-[11.5px]" onClick={() => setActiveId(null)}>
                    <Search size={12} /> New list
                  </button>
                  <span className="text-[11.5px] text-[var(--muted)]">
                    {active.replay ? 'Replayed' : 'Made'} as of{' '}
                    <b className="text-[var(--text)]">{nice(active.since)}</b> · {active.accounts.length}{' '}
                    customers
                    {active.replay ? '' : ` · ${contacted} contacted`} · from {active.source}
                  </span>
                  <input
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                    placeholder="Your shop name"
                    maxLength={80}
                    className="input ml-auto !h-7 w-[140px] text-[11.5px]"
                    aria-label="Shop name used in the messages"
                  />
                </div>
                {active.replay && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11.5px]"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--sky) 55%, transparent)',
                      background: 'color-mix(in srgb, var(--sky) 12%, transparent)',
                    }}
                  >
                    <History size={14} className="mt-0.5 flex-none" style={{ color: 'var(--sky)' }} />
                    <span>
                      <b>Historical replay: no outreach recorded.</b> These customers are from the shop’s
                      past, and any later orders are its real records. This demonstrates the recheck, not the
                      effect of contacting anyone, so contacts can’t be logged here.
                    </span>
                  </motion.div>
                )}
                <div className="max-h-[340px] overflow-y-auto pr-1">
                  {active.accounts.map((a, i) => {
                    const isOpen = open === a.customer;
                    const out = active.last_check?.accounts.find((x) => x.customer === a.customer);
                    return (
                      <motion.div
                        key={a.customer}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * i }}
                        className="border-b last:border-0"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-[12px]">
                          <button
                            className="min-w-0 text-left"
                            onClick={() => setOpen(isOpen ? null : a.customer)}
                            aria-expanded={isOpen}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-semibold">{a.email ?? a.customer}</span>
                              {out && <Outcome o={out} replay={active.replay} />}
                              <motion.span
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                className="text-[var(--faint)]"
                              >
                                <ChevronDown size={12} />
                              </motion.span>
                            </span>
                            <span className="block truncate text-[11px] text-[var(--faint)]">
                              {usd(a.spend, true)} the year before · {a.orders} orders
                              {a.typicalGapDays ? ` · usually every ${a.typicalGapDays} days` : ''}
                              {a.status === 'skipped' && a.skipReason
                                ? ` · skipped (you said: ${SKIP_REASONS.find((r) => r.id === a.skipReason)?.label.toLowerCase()})`
                                : ''}
                              {a.note ? ' · has a note' : ''}
                            </span>
                          </button>
                          {active.replay ? (
                            <span
                              className="chip !py-0 text-[10.5px]"
                              style={{ '--c': 'var(--sky)' } as CSSProperties}
                            >
                              Replay
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              {a.status === 'contacted' && a.contactedOn && (
                                <DayPicker
                                  value={a.contactedOn}
                                  min={active.since}
                                  max={today()}
                                  onChange={(d) => setAcc(a, { contactedOn: d })}
                                />
                              )}
                              <Seg
                                small
                                value={a.status}
                                onChange={(s) => {
                                  setAcc(a, {
                                    status: s,
                                    contactedOn: s === 'contacted' ? (a.contactedOn ?? today()) : null,
                                  });
                                  if (s === 'skipped') setOpen(a.customer);
                                }}
                                options={(Object.keys(STATUS) as Status[]).map((s) => ({
                                  id: s,
                                  label: STATUS[s].label,
                                  c: STATUS[s].c,
                                }))}
                              />
                            </span>
                          )}
                        </div>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div
                                className="tint mb-2 space-y-2 rounded-lg p-2.5"
                                style={{ '--c': 'var(--violet)' } as CSSProperties}
                              >
                                {a.status === 'skipped' && (
                                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                                    <span className="text-[var(--muted)]">
                                      Why skip them? (optional, your call)
                                    </span>
                                    {SKIP_REASONS.map((r) => (
                                      <button
                                        key={r.id}
                                        onClick={() =>
                                          setAcc(a, { skipReason: a.skipReason === r.id ? null : r.id })
                                        }
                                        className="chip !py-0.5 text-[10.5px]"
                                        style={
                                          {
                                            '--c': a.skipReason === r.id ? 'var(--amber)' : 'var(--faint)',
                                          } as CSSProperties
                                        }
                                        aria-pressed={a.skipReason === r.id}
                                      >
                                        {r.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <textarea
                                  value={a.note}
                                  onChange={(e) => setAcc(a, { note: e.target.value.slice(0, 500) }, false)}
                                  placeholder="Note: what you said, what they said..."
                                  rows={2}
                                  className="input w-full resize-none !py-1.5 text-[12px]"
                                />
                                <AiWinback
                                  customer={a.customer}
                                  shopName={shopName}
                                  asOf={active.replay ? active.since : undefined}
                                  template={draft(shopName)}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button className="btn !h-7 text-[11.5px]" onClick={() => exportList(active)}>
                    <Download size={12} /> Download list
                  </button>
                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Delete list and notes"
                    onConfirm={() => {
                      void fu.remove(active.id);
                      setActiveId(null);
                    }}
                  />
                  <span className="self-center text-[11px] text-[var(--faint)]">
                    Nothing is sent from BlindSpot. Copy a message into your own email.
                  </span>
                </div>
                <Funnel list={active} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: recheck */}
        <div className="min-w-0 lg:col-span-5">
          <Recheck
            list={active}
            checking={checking}
            err={checkErr}
            reason={checkReason}
            onCheck={() => void recheck()}
            dataEnd={end}
            confirmShop={unassigned && confirmOther ? { shop: listShop, data: dataset?.name ?? '' } : null}
            onConfirmShop={() => void recheck(true)}
            onCancelOther={() => setConfirmOther(false)}
            backtest={!active && mode === 'now' ? nowQ.data?.backtest : undefined}
          />
        </div>
      </div>
    </Card>
  );
}

const draft = (shop: string) =>
  `Hi there,\n\nIt's been a while since your last order with ${shop}, and we wanted to say thank you for being one of our best customers. If anything about your last order wasn't right, just reply and tell us.\n\nThank you,\n${shop}`;

function Recheck({
  list,
  checking,
  err,
  reason,
  onCheck,
  dataEnd,
  confirmShop,
  onConfirmShop,
  onCancelOther,
  backtest,
}: {
  list: FollowList | null;
  checking: boolean;
  err: string | null;
  reason: string | null;
  onCheck: () => void;
  dataEnd?: string;
  /** Set while the owner must say whether the loaded export is from this list's shop. */
  confirmShop: { shop: string; data: string } | null;
  onConfirmShop: () => void;
  onCancelOther: () => void;
  backtest?: WB['backtest'];
}) {
  const c = list?.last_check;
  const shell = (children: ReactNode) => (
    <div
      className="tint relative h-full overflow-hidden rounded-xl p-3"
      style={{ '--c': 'var(--emerald)' } as CSSProperties}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold">
        <RefreshCcw size={13} style={{ color: 'var(--emerald)' }} /> Recheck: who ordered again?
      </div>
      {children}
    </div>
  );
  if (!list)
    return shell(
      <div className="space-y-2 text-[12px] text-[var(--muted)]">
        {backtest?.ok && <RuleBacktest bt={backtest} />}
        {[
          ['1', 'Tick the customers you’ll contact and start a list.'],
          ['2', 'Mark who you reached. The contact day is saved, and you can correct it.'],
          [
            '3',
            'Later, upload a newer export from the same shop. BlindSpot matches the same customer IDs and shows who ordered after the list, and after each contact.',
          ],
        ].map(([n, t], i) => (
          <motion.div
            key={n}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex gap-2"
          >
            <span
              className="mono grid h-5 w-5 flex-none place-items-center rounded-full text-[10.5px] font-bold"
              style={{
                background: 'color-mix(in srgb, var(--emerald) 22%, transparent)',
                color: 'var(--emerald)',
              }}
            >
              {n}
            </span>
            {t}
          </motion.div>
        ))}
        <div className="pt-1 text-[11px] text-[var(--faint)]">
          Try <b>Practice on past data</b> to see the recheck on a real shop’s history right now.
        </div>
      </div>,
    );
  const canCheck = list.replay || (dataEnd ? dataEnd >= list.since : false);
  const cov = c?.coverage;
  const lowMatch =
    !!c && c.matched + c.unmatched.length > 0 && c.matched / (c.matched + c.unmatched.length) < 0.5;
  return shell(
    <>
      <div className="mb-2 text-[11.5px] text-[var(--muted)]">
        Reads the whole loaded data (filters must be off){dataEnd ? `, through ${nice(dataEnd)}` : ''}, and
        matches each exact customer ID from the list made {list.replay ? 'as of' : 'on'}{' '}
        <b className="text-[var(--text)]">{nice(list.since)}</b>.
      </div>
      <AnimatePresence>
        {confirmShop && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 overflow-hidden rounded-lg border px-2.5 py-2 text-[11.5px]"
            style={{ borderColor: 'color-mix(in srgb, var(--amber) 55%, transparent)' }}
          >
            <div className="mb-0.5 text-[12.5px] font-extrabold">Which shop is this export from?</div>
            Confirm that <b>{confirmShop.data}</b> is an export from <b>{confirmShop.shop}</b>. This is your
            declaration: customer IDs only mean the same thing within one shop, and a file name can’t prove
            where a file came from.
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button className="btn btn-primary !h-7 text-[11.5px]" onClick={onConfirmShop}>
                Yes, it’s from {confirmShop.shop}
              </button>
              <button className="btn !h-7 text-[11.5px]" onClick={onCancelOther}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!confirmShop && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCheck}
          disabled={checking}
          className="btn btn-primary mb-2 !h-8 w-full justify-center text-[12px]"
        >
          {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          {checking
            ? 'Matching customer IDs in the newer data…'
            : list.replay
              ? 'Check the shop’s real later orders'
              : c
                ? 'Check again with the data loaded now'
                : 'Check who ordered again'}
        </motion.button>
      )}
      {!canCheck && !c && !reason && (
        <div className="mb-2 flex items-start gap-1.5 text-[11.5px] text-[var(--muted)]">
          <Upload size={12} className="mt-0.5 flex-none" />
          The data loaded now ends before this list was made. Upload a newer export on Data Sources, then
          check.
        </div>
      )}
      {reason && (
        <div
          className="mb-2 rounded-lg border px-2.5 py-2 text-[11.5px]"
          style={{ borderColor: 'var(--line)' }}
        >
          {reason}{' '}
          {/newer export|Data Sources/.test(reason) && (
            <a href="#/data" className="font-bold" style={{ color: 'var(--emerald)' }}>
              Upload a newer export →
            </a>
          )}
        </div>
      )}
      {err && (
        <div className="mb-2 text-[11.5px]" style={{ color: 'var(--rose)' }}>
          {err}
        </div>
      )}
      <AnimatePresence mode="wait">
        {c && (
          <motion.div
            key={c.at}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-3">
              <MiniRing value={pct(c.orderedAgain, list.accounts.length)} />
              <div className="min-w-0">
                <div className="text-[12.5px]">
                  <b className="mono text-[18px]">{c.orderedAgain}</b>{' '}
                  <span className="text-[var(--muted)]">
                    of {list.accounts.length} listed had a recorded later order
                  </span>
                </div>
                <div className="text-[11.5px] text-[var(--muted)]">
                  {c.matched} found in this data ·{' '}
                  <b className={c.unmatched.length ? 'text-[var(--text)]' : ''}>
                    {c.unmatched.length} couldn’t be matched
                  </b>
                  {c.coverage?.thin ? ' · coverage has gaps' : ''}
                </div>
                <div className="text-[12px] text-[var(--muted)]">
                  <b className="mono text-[var(--text)]">{usd(c.salesAfter)}</b> in recorded later orders over{' '}
                  {c.daysObserved} days (returns excluded)
                </div>
              </div>
            </div>
            {!list.replay && c.contacted && (
              <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
                <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: 'var(--line)' }}>
                  <div className="text-[var(--muted)]">After their contact day</div>
                  <div>
                    <b className="mono text-[14px]">{c.contacted.orderedAfter}</b> of {c.contacted.customers}{' '}
                    contacted · {usd(c.contacted.salesAfter, true)}
                  </div>
                  {c.contacted.sameDay > 0 && (
                    <div className="text-[10.5px] text-[var(--faint)]">
                      +{c.contacted.sameDay} ordered on the contact day itself (timing unknown, not counted)
                    </div>
                  )}
                </div>
                <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: 'var(--line)' }}>
                  <div className="text-[var(--muted)]">Not contacted</div>
                  <div>
                    <b className="mono text-[14px]">{c.notContacted.orderedSince}</b> of{' '}
                    {c.notContacted.customers} ordered since the list
                  </div>
                </div>
              </div>
            )}
            {cov && (
              <div
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
                style={{
                  background: cov.thin
                    ? 'color-mix(in srgb, var(--amber) 14%, transparent)'
                    : 'color-mix(in srgb, var(--emerald) 8%, transparent)',
                }}
              >
                <b>Window read:</b> {nice(cov.from)} to {nice(cov.to)}.{' '}
                {cov.thin ? (
                  <>
                    <b>No rows at all for {cov.longestGapDays} days</b> ({nice(cov.gapFrom!)} to{' '}
                    {nice(cov.gapTo!)}). The export may be incomplete, so “no order seen” may only mean “not
                    in this file”.
                  </>
                ) : (
                  <>
                    The shop has sales throughout (longest quiet stretch {cov.longestGapDays} day
                    {cov.longestGapDays === 1 ? '' : 's'}). “No order seen” assumes this export covers all
                    products and countries.
                  </>
                )}
              </div>
            )}
            {c.baseline && (
              <div className="text-[11.5px]">
                <div className="mb-0.5 flex justify-between gap-2 text-[var(--muted)]">
                  <span>Repeat customers not on this list (2+ orders before the list date)</span>
                  <span className="mono flex-none">
                    {pct(c.baseline.orderedAgain, c.baseline.customers)}% ordered
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-[var(--line)]">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: 'var(--sky)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct(c.baseline.orderedAgain, c.baseline.customers)}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--faint)]">
                  {c.baseline.orderedAgain.toLocaleString()} of {c.baseline.customers.toLocaleString()}, same
                  window. A different, broader group: context, not a comparison of outcomes.
                </div>
              </div>
            )}
            {(c.unmatched.length > 0 || lowMatch) && (
              <div
                className="rounded-lg border px-2.5 py-1.5 text-[11.5px]"
                style={{
                  borderColor: lowMatch ? 'color-mix(in srgb, var(--amber) 55%, transparent)' : 'var(--line)',
                }}
              >
                <b>
                  {c.unmatched.length} ID{c.unmatched.length === 1 ? '' : 's'} not found
                </b>{' '}
                in the newer data: {c.unmatched.slice(0, 4).join(', ')}
                {c.unmatched.length > 4 ? '…' : ''}. Left out of every count above.
                {lowMatch && ' Most IDs are missing: check this export is from the same shop.'}
              </div>
            )}
            <div className="flex items-start gap-1.5 text-[11px] text-[var(--faint)]">
              <ShieldCheck size={12} className="mt-0.5 flex-none" style={{ color: 'var(--emerald)' }} />
              Recorded orders only. Ordering after a contact is not proof the contact caused it.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
  );
}

/** Where the list stands: listed → contacted → ordered after contact. A replay has no contacts, so it shows
 * listed → found → ordered since the list. Read as a record, never as cause and effect. */
function Funnel({ list }: { list: FollowList }) {
  const n = list.accounts.length;
  const contacted = list.accounts.filter((a) => a.status === 'contacted').length;
  const c = list.last_check;
  const stages = list.replay
    ? [
        { l: 'On the list', v: n, c: 'var(--violet)', t: `${n}` },
        { l: 'Found later', v: c?.matched ?? 0, c: 'var(--sky)', t: c ? `${c.matched}` : '–' },
        {
          l: 'Ordered since',
          v: c?.orderedAgain ?? 0,
          c: 'var(--emerald)',
          t: c ? `${c.orderedAgain}` : '–',
        },
      ]
    : [
        { l: 'On the list', v: n, c: 'var(--violet)', t: `${n}` },
        { l: 'Contacted', v: contacted, c: 'var(--amber)', t: `${contacted}` },
        {
          l: 'Ordered after contact',
          v: c?.contacted?.orderedAfter ?? 0,
          c: 'var(--emerald)',
          t: c?.contacted ? `${c.contacted.orderedAfter}` : '–',
        },
      ];
  return (
    <div className="mt-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--line)' }}>
      <div className="grid grid-cols-3 gap-2">
        {stages.map((s, i) => (
          <div key={s.l}>
            <div className="flex items-baseline justify-between gap-1 text-[11px] text-[var(--muted)]">
              <span className="truncate">{s.l}</span>
              <span className="mono text-[13px] font-semibold text-[var(--text)]">{s.t}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--line)]">
              <motion.div
                className="h-2 rounded-full"
                style={{ background: s.c, boxShadow: `0 0 8px ${s.c}` }}
                initial={{ width: 0 }}
                animate={{ width: `${n ? (s.v / n) * 100 : 0}%` }}
                transition={{ duration: 0.8, delay: i * 0.12 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11.5px] text-[var(--muted)]">
        {list.replay
          ? c
            ? 'These are the shop’s real later orders. Nobody was contacted, so none of this is a result of outreach.'
            : 'Press “Check the shop’s real later orders” to run the recheck on its history.'
          : !c
            ? contacted
              ? 'Mark the rest as you go. When a newer export is in, press Recheck.'
              : 'Mark each customer as you reach them. Statuses and notes save as you type.'
            : 'Small, self-chosen groups: read this as a record of what happened, not a test of what works.'}
      </div>
    </div>
  );
}

function Outcome({ o, replay }: { o: CheckAccount; replay: boolean }) {
  const [c, t, Icon] = !o.found
    ? (['var(--muted)', 'ID not found', X] as const)
    : o.ordersAfter
      ? (['var(--emerald)', `Ordered since · ${usd(o.salesAfter, true)}`, CalendarCheck] as const)
      : (['var(--faint)', 'No order seen', CircleDashed] as const);
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="chip flex-none !py-0 text-[10.5px]"
      style={{ '--c': c } as CSSProperties}
      title={
        !replay && o.contactedOn
          ? `${o.ordersAfterContact} order(s) on later days than the contact${o.sameDayOrders ? `, ${o.sameDayOrders} on the contact day` : ''}`
          : undefined
      }
    >
      <Icon size={10} />
      {t}
    </motion.span>
  );
}

/** A themed day picker (no native date input): a month grid between `min` and `max`. */
function DayPicker({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (d: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const first = Date.parse(`${month}-01T00:00:00Z`);
  const lead = new Date(first).getUTCDay();
  const days = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const shift = (n: number) => {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  return (
    <div ref={ref} className="relative">
      <button
        className="btn !h-6 !px-1.5 text-[10.5px]"
        onClick={() => {
          setMonth(value.slice(0, 7));
          setOpen(!open);
        }}
        title="Correct the contact day"
        aria-label={`Contacted on ${nice(value)}. Change the day`}
      >
        <CalendarCheck size={11} style={{ color: 'var(--amber)' }} />
        {nice(value).replace(/, \d{4}$/, '')}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className="panel absolute right-0 z-50 mt-1 w-[214px] p-2"
            style={{ background: 'var(--panel-solid)' }}
          >
            <div className="mb-1 flex items-center justify-between text-[11.5px] font-bold">
              <button className="btn !h-6 !px-1.5" onClick={() => shift(-1)} aria-label="Previous month">
                ‹
              </button>
              {new Date(first).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
              <button className="btn !h-6 !px-1.5" onClick={() => shift(1)} aria-label="Next month">
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10.5px]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="py-0.5 text-[var(--faint)]">
                  {d}
                </span>
              ))}
              {Array.from({ length: lead }).map((_, i) => (
                <span key={`l${i}`} />
              ))}
              {Array.from({ length: days }).map((_, i) => {
                const d = `${month}-${String(i + 1).padStart(2, '0')}`;
                const off = d < min || d > max;
                const on = d === value;
                return (
                  <button
                    key={d}
                    disabled={off}
                    onClick={() => {
                      onChange(d);
                      setOpen(false);
                    }}
                    className="rounded py-1 font-semibold transition-colors disabled:opacity-25"
                    style={{ background: on ? 'var(--amber)' : undefined, color: on ? '#1a1206' : undefined }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A destructive button that asks once in place (no browser dialog). */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <motion.button
      layout
      whileTap={{ scale: 0.95 }}
      className="btn !h-7 text-[11.5px]"
      style={armed ? { borderColor: 'var(--rose)', color: 'var(--rose)' } : undefined}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      <Trash2 size={12} />
      {armed ? confirmLabel : label}
    </motion.button>
  );
}

/** The exact quiet-customer rule, replayed on this shop's own past: who stayed away the next 180 days. */
function RuleBacktest({ bt }: { bt: NonNullable<WB['backtest']> }) {
  const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);
  // Open the first time; after that it stays out of the way (one click to reopen), so owners get to the list.
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem('blindspot.rule-test-seen');
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('blindspot.rule-test-seen', '1');
    } catch {
      /* fine: it just opens again next time */
    }
  }, []);
  const rng = (xs: number[]) => {
    const lo = Math.min(...xs),
      hi = Math.max(...xs);
    return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
  };
  const summary = `${rng(bt.replays.map((r) => pct(r.flaggedStayedAway, r.flagged)))} of flagged vs ${rng(bt.replays.map((r) => pct(r.othersStayedAway, r.others)))} of other top customers stayed away`;
  return (
    <div className="mb-1 rounded-lg border px-2.5 py-2" style={{ borderColor: 'var(--line)' }}>
      <button
        className="flex w-full items-center gap-1.5 text-left text-[11.5px] font-bold text-[var(--text)]"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <History size={12} style={{ color: 'var(--violet)' }} /> This rule, tested on this shop’s past
        {!open && <span className="ml-1 truncate font-normal text-[var(--muted)]">· {summary}</span>}
        <motion.span className="ml-auto text-[var(--faint)]" animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown size={12} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-1"
          >
            {bt.replays.map((r, i) => {
              const f = pct(r.flaggedStayedAway, r.flagged),
                o = pct(r.othersStayedAway, r.others);
              return (
                <div key={r.asOf} className="mb-1.5 last:mb-0">
                  <div className="flex justify-between text-[11px]">
                    <span>
                      As of <b className="text-[var(--text)]">{nice(r.asOf)}</b> · no order in the next{' '}
                      {r.windowDays} days
                    </span>
                    <span className="mono">{fmtP(r.p)}</span>
                  </div>
                  {[
                    {
                      l: `Flagged (${r.flagged})`,
                      v: f,
                      t: `${r.flaggedStayedAway} of ${r.flagged}`,
                      c: 'var(--amber)',
                    },
                    {
                      l: `Other top customers (${r.others})`,
                      v: o,
                      t: `${r.othersStayedAway} of ${r.others}`,
                      c: 'var(--emerald)',
                    },
                  ].map((x, k) => (
                    <div
                      key={x.l}
                      className="mt-0.5 grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_88px] items-center gap-2 text-[10.5px]"
                    >
                      <span className="truncate">{x.l}</span>
                      <span className="h-1.5 rounded-full bg-[var(--line)]">
                        <motion.span
                          className="block h-1.5 rounded-full"
                          style={{ background: x.c }}
                          initial={{ width: 0 }}
                          animate={{ width: `${x.v}%` }}
                          transition={{ duration: 0.8, delay: 0.1 + i * 0.15 + k * 0.08 }}
                        />
                      </span>
                      <span className="mono text-right">
                        {x.v}% · {x.t}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="mt-1 text-[10.5px] text-[var(--faint)]">
              Same rule as this list, using only earlier orders each time. One-sided Fisher exact test. The
              two windows overlap, so they’re two looks at one shop. Most flagged customers still came back.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center" aria-label={`Step ${step + 1} of 4`}>
      {STEPS.map((s, i) => {
        const done = i < step,
          now = i === step;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            {i > 0 && (
              <div className="relative mx-1 h-px w-5 bg-[var(--line-strong)]">
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{ background: s.c, boxShadow: `0 0 6px ${s.c}` }}
                  initial={false}
                  animate={{ width: i <= step ? '100%' : '0%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
            <motion.span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
              animate={{
                background: now || done ? `color-mix(in srgb, ${s.c} 20%, transparent)` : 'transparent',
                color: now || done ? 'var(--text)' : 'var(--faint)',
                boxShadow: now ? `0 0 12px -3px ${s.c}` : '0 0 0 0 transparent',
              }}
            >
              {done ? <Check size={11} style={{ color: s.c }} /> : <Icon size={11} style={{ color: s.c }} />}
              {s.label}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; c?: string }[];
  small?: boolean;
}) {
  const id = useMemo(() => Math.random().toString(36).slice(2), []);
  return (
    <div className="relative flex rounded-lg border p-0.5" style={{ borderColor: 'var(--line)' }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`relative rounded-md font-bold transition-colors ${small ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-1 text-[11.5px]'}`}
          style={{ color: value === o.id ? 'var(--text)' : 'var(--muted)' }}
          aria-pressed={value === o.id}
        >
          {value === o.id && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-md"
              style={{
                background: `color-mix(in srgb, ${o.c ?? 'var(--violet)'} 24%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${o.c ?? 'var(--violet)'} 45%, transparent)`,
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <motion.span
      className="grid h-4 w-4 place-items-center rounded border"
      animate={{
        background: on ? 'var(--violet)' : 'transparent',
        borderColor: on ? 'var(--violet)' : 'var(--line-strong)',
        scale: on ? [1, 1.2, 1] : 1,
      }}
      transition={{ duration: 0.2 }}
    >
      {on && <Check size={11} color="white" />}
    </motion.span>
  );
}

function MiniRing({ value }: { value: number }) {
  const r = 22,
    C = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="flex-none">
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
      <motion.circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="var(--emerald)"
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - value / 100) }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ filter: 'drop-shadow(0 0 4px var(--emerald))' }}
      />
      <text
        x="28"
        y="32"
        textAnchor="middle"
        className="mono"
        fontSize="12"
        fontWeight="700"
        fill="var(--text)"
      >
        {value}%
      </text>
    </svg>
  );
}

function SaveChip({ where, error, onClear }: { where: string; error: string | null; onClear?: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <span className="flex items-center gap-1">
      <span
        className="chip !py-0.5 text-[10.5px]"
        style={{ '--c': error ? 'var(--amber)' : 'var(--emerald)' } as CSSProperties}
        title={
          error ??
          (where === 'account'
            ? 'Only you can read or change these lists.'
            : 'Stored in this browser only. Anyone using this browser can see them. Log in to keep them private to your account.')
        }
      >
        {error ? 'Not saved' : where === 'account' ? 'Saved to your account' : 'Saved in this browser'}
      </span>
      {where === 'browser' && onClear && (
        <button
          className="text-[10.5px] font-bold underline-offset-2 hover:underline"
          style={{ color: armed ? 'var(--rose)' : 'var(--faint)' }}
          onClick={() => {
            if (armed) {
              onClear();
              setArmed(false);
            } else setArmed(true);
          }}
          onBlur={() => setArmed(false)}
        >
          {armed ? 'Clear all lists here?' : 'Clear'}
        </button>
      )}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="h-8 rounded-md bg-[var(--line)]"
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.08 }}
        />
      ))}
      <div className="flex items-center gap-1.5 pt-1 text-[11.5px] text-[var(--muted)]">
        <Loader2 size={12} className="animate-spin" /> Reading each customer’s order history…
      </div>
    </div>
  );
}
