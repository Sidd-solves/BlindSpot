import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
import { useTool } from './useTool';
import { AiWinback } from './AiWinback';
import { Card, CountUp, Dropdown } from './ui';
import {
  useFollowUps,
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
};
type FU = FollowCheck & { ok: boolean; reason?: string; since: string; note: string };

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
  const shopName = shop.trim() || 'our shop';

  const nowQ = useTool<WB>('win-back-list', { shopName: 'our shop' }, [version]);
  const end = nowQ.data?.asOf;
  const asOf = mode === 'replay' && end ? addDays(end, -back + 1) : undefined;
  const repQ = useTool<WB>('win-back-list', { shopName: 'our shop', asOf }, [version, asOf], !!asOf);
  const wb = mode === 'replay' ? repQ.data : nowQ.data;
  const since = mode === 'replay' ? asOf : end ? addDays(end, 1) : undefined;

  const active = fu.lists.find((l) => l.id === activeId) ?? null;
  // Pick the most recent list once lists load, so a returning owner lands on their work.
  useEffect(() => {
    if (fu.loaded && activeId === null && fu.lists[0] && mode === 'now') setActiveId(fu.lists[0].id);
  }, [fu.loaded]);
  // A new list (or mode) starts with nobody ticked: the owner decides, the tool doesn't pre-choose.
  useEffect(() => setPicked(new Set()), [wb]);
  useEffect(() => {
    setCheckReason(null);
    setCheckErr(null);
  }, [activeId, version]);

  const step = !active ? (picked.size ? 1 : 0) : active.last_check ? 3 : 2;
  const contacted = active?.accounts.filter((a) => a.status === 'contacted').length ?? 0;
  const top = wb?.customers.reduce((m, c) => Math.max(m, c.share ?? 0), 0) ?? 0;
  const topC = wb?.customers.find((c) => (c.share ?? 0) === top);

  const start = () => {
    if (!wb || !since) return;
    const accounts: FollowAccount[] = wb.customers
      .filter((c) => picked.has(c.customer))
      .map((c) => ({
        customer: c.customer,
        email: c.email,
        spend: c.spend,
        share: c.share ?? 0,
        orders: c.orderDays ?? c.orders,
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
      accounts,
    });
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
  const recheck = async () => {
    if (!active) return;
    setChecking(true);
    setCheckErr(null);
    setCheckReason(null);
    const r = await tool<FU>('follow-up-check', {
      since: active.since,
      customers: active.accounts.map((a) => a.customer),
    });
    setChecking(false);
    if (!r.ok || !r.data) return setCheckErr(r.error?.message ?? 'The recheck failed.');
    if (!r.data.ok) return setCheckReason(r.data.reason ?? 'Nothing to compare yet.');
    const d = r.data;
    fu.update(
      {
        ...active,
        last_check: {
          at: new Date().toISOString(),
          dataEnd: d.dataEnd,
          daysObserved: d.daysObserved,
          matched: d.matched,
          unmatched: d.unmatched,
          orderedAgain: d.orderedAgain,
          salesAfter: d.salesAfter,
          baseline: d.baseline,
          accounts: d.accounts.map((a) => ({
            customer: a.customer,
            found: a.found,
            ordersAfter: a.ordersAfter,
            salesAfter: a.salesAfter,
            firstOrderAfter: a.firstOrderAfter,
          })),
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
        'Ordered again',
        'Orders after',
        'Sales after (returns excluded)',
        'First order after',
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
          o ? (!o.found ? 'Not in newer data' : o.ordersAfter ? 'Yes' : 'No') : '',
          o?.ordersAfter ?? '',
          o?.salesAfter ?? '',
          o?.firstOrderAfter ?? '',
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
          <SaveChip where={fu.where} error={fu.error} />
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
                      BlindSpot reads only the orders before <b>{nice(asOf)}</b>, as if that were today.
                      Recheck then looks at the real orders that came after, so you can see how a list like
                      this plays out.
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
                        {topC.orderDays ?? topC.orders} order days). Check its history before reading the
                        total as typical.
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
                                {c.orderDays ?? c.orders} order days
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
                  {active.replay && (
                    <span className="chip" style={{ '--c': 'var(--sky)' } as CSSProperties}>
                      <History size={11} /> Practice run on past data
                    </span>
                  )}
                  <span className="text-[11.5px] text-[var(--muted)]">
                    Made as of <b className="text-[var(--text)]">{nice(active.since)}</b> · {contacted} of{' '}
                    {active.accounts.length} contacted
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
                              {out && <Outcome o={out} />}
                              <motion.span
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                className="text-[var(--faint)]"
                              >
                                <ChevronDown size={12} />
                              </motion.span>
                            </span>
                            <span className="block truncate text-[11px] text-[var(--faint)]">
                              {usd(a.spend, true)} the year before · {a.orders} order days
                              {a.typicalGapDays ? ` · usually every ${a.typicalGapDays} days` : ''}
                              {a.contactedOn ? ` · contacted ${nice(a.contactedOn)}` : ''}
                            </span>
                          </button>
                          <Seg
                            small
                            value={a.status}
                            onChange={(s) =>
                              setAcc(a, {
                                status: s,
                                contactedOn: s === 'contacted' ? (a.contactedOn ?? today()) : null,
                              })
                            }
                            options={(Object.keys(STATUS) as Status[]).map((s) => ({
                              id: s,
                              label: STATUS[s].label,
                              c: STATUS[s].c,
                            }))}
                          />
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
                  <button
                    className="btn !h-7 text-[11.5px]"
                    onClick={() => {
                      if (confirm(`Delete “${active.name}”? This removes its statuses and notes.`)) {
                        void fu.remove(active.id);
                        setActiveId(null);
                      }
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <span className="self-center text-[11px] text-[var(--faint)]">
                    Nothing is sent from BlindSpot. Copy a message into your own email.
                  </span>
                </div>
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
            onCheck={recheck}
            dataEnd={end}
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
}: {
  list: FollowList | null;
  checking: boolean;
  err: string | null;
  reason: string | null;
  onCheck: () => void;
  dataEnd?: string;
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
        {[
          ['1', 'Tick the customers you’ll contact and start a list.'],
          ['2', 'Mark who you reached and keep a note.'],
          [
            '3',
            'Later, upload a newer export. BlindSpot matches the same customer IDs and shows who ordered again.',
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
          Try <b>Practice on past data</b> to see the whole loop on real orders right now.
        </div>
      </div>,
    );
  const canCheck = list.replay || (dataEnd ? dataEnd >= list.since : false);
  return shell(
    <>
      <div className="mb-2 text-[11.5px] text-[var(--muted)]">
        Counts orders on or after <b className="text-[var(--text)]">{nice(list.since)}</b> in the data loaded
        now
        {dataEnd ? ` (through ${nice(dataEnd)})` : ''}, matched by exact customer ID.
      </div>
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
            ? 'Check against the real orders that came next'
            : c
              ? 'Check again with the data loaded now'
              : 'Check who ordered again'}
      </motion.button>
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
          <a href="#/data" className="font-bold" style={{ color: 'var(--emerald)' }}>
            Upload a newer export →
          </a>
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
              <MiniRing value={pct(c.orderedAgain, c.matched)} />
              <div className="min-w-0">
                <div className="text-[12.5px]">
                  <b className="mono text-[18px]">{c.orderedAgain}</b>{' '}
                  <span className="text-[var(--muted)]">of {c.matched} ordered again</span>
                </div>
                <div className="text-[12px] text-[var(--muted)]">
                  <b className="mono text-[var(--text)]">{usd(c.salesAfter)}</b> in real orders over{' '}
                  {c.daysObserved} days (returns excluded)
                </div>
              </div>
            </div>
            {c.baseline && (
              <div className="text-[11.5px]">
                <div className="mb-0.5 flex justify-between text-[var(--muted)]">
                  <span>Other repeat customers, same window</span>
                  <span className="mono">
                    {pct(c.baseline.orderedAgain, c.baseline.customers)}% (
                    {c.baseline.orderedAgain.toLocaleString()} of {c.baseline.customers.toLocaleString()})
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
                  Context, not a control group: those customers weren’t on the list and weren’t contacted
                  through it.
                </div>
              </div>
            )}
            {c.unmatched.length > 0 && (
              <div
                className="rounded-lg border px-2.5 py-1.5 text-[11.5px]"
                style={{ borderColor: 'var(--line)' }}
              >
                <b>{c.unmatched.length} not found</b> in the newer data by exact ID:{' '}
                {c.unmatched.slice(0, 4).join(', ')}
                {c.unmatched.length > 4 ? '…' : ''}. They are left out of the counts above.
              </div>
            )}
            <div className="flex items-start gap-1.5 text-[11px] text-[var(--faint)]">
              <ShieldCheck size={12} className="mt-0.5 flex-none" style={{ color: 'var(--emerald)' }} />
              Observed orders only. “Ordered again after contact” is not proof the contact caused it.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
  );
}

function Outcome({ o }: { o: NonNullable<FollowList['last_check']>['accounts'][number] }) {
  const [c, t] = !o.found
    ? ['var(--muted)', 'Not in newer data']
    : o.ordersAfter
      ? ['var(--emerald)', `Ordered again · ${usd(o.salesAfter, true)}`]
      : ['var(--faint)', 'No order yet'];
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="chip flex-none !py-0 text-[10.5px]"
      style={{ '--c': c } as CSSProperties}
    >
      {o.ordersAfter ? <CalendarCheck size={10} /> : o.found ? <CircleDashed size={10} /> : <X size={10} />}
      {t}
    </motion.span>
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

function SaveChip({ where, error }: { where: string; error: string | null }) {
  return (
    <span
      className="chip !py-0.5 text-[10.5px]"
      style={{ '--c': error ? 'var(--amber)' : 'var(--emerald)' } as CSSProperties}
      title={error ?? undefined}
    >
      {error ? 'Not saved' : where === 'account' ? 'Saved to your account' : 'Saved in this browser'}
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
