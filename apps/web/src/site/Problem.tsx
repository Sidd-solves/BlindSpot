import { motion, useInView } from 'framer-motion';
import { useRef, type CSSProperties } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  ListChecks,
  PhoneCall,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { CountUp, Reveal } from '../components/ui';
import { BeamCard } from './Effects';
import { EVIDENCE, CASE } from './content';
import { useOpenSample } from './Start';

/**
 * The problem, stated once and backed link by link: small businesses matter, most don't last, repeat customers
 * separate the ones that do, and most owners can't read the data that would warn them. Every figure carries its
 * source. Then the case study shows it happening in real rows.
 */
export function ProblemEvidence() {
  return (
    <section className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:px-6" id="problem">
      <Reveal>
        <div className="label" style={{ color: 'var(--amber)' }}>
          The problem
        </div>
        <h2 className="mt-1.5 max-w-3xl text-[26px] font-extrabold leading-[1.1] tracking-tight md:text-[38px]">
          Small shops live on repeat customers.{' '}
          <span className="grad-text">Most owners can’t see them leaving.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)]">
          A regular doesn’t say goodbye. They just stop ordering, while the sales total still looks fine. The
          signal is already in the shop’s own sales export, but nothing points it out.
        </p>
      </Reveal>
      <Reveal className="mt-7">
        <div className="label">Why this problem matters</div>
      </Reveal>

      <div className="relative mt-3">
        <div className="grid gap-3 md:grid-cols-3">
          {EVIDENCE.map((e, i) => (
            <EvidenceRow key={e.id} e={e} i={i} />
          ))}
        </div>
      </div>

      <CaseProof />
    </section>
  );
}

function EvidenceRow({ e, i }: { e: (typeof EVIDENCE)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-10%' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={seen ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: i * 0.1 }}
      whileHover={{ y: -3 }}
      className="panel card-live relative flex h-full flex-col overflow-hidden px-4 py-3.5"
      style={{ '--c': e.c } as CSSProperties}
    >
      <div className="card-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: e.c }}>
        {e.link}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        {e.stats.map((s, k) => (
          <span key={k} className="flex items-baseline gap-1">
            {k > 0 && <span className="text-[13px] text-[var(--faint)]">vs</span>}
            <span className="text-[30px] font-semibold leading-none" style={{ color: s.c ?? 'var(--text)' }}>
              {seen ? (
                <CountUp value={s.v} format={s.f} duration={1.3} />
              ) : (
                <span className="mono">{s.f(0)}</span>
              )}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-2 flex-1 text-[13px] font-semibold leading-snug">{e.claim}</div>
      <div className="mt-2 text-[11px] text-[var(--faint)]">
        <a
          href={e.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
          style={{ color: 'var(--muted)' }}
        >
          {e.source}
          <ExternalLink size={10} />
        </a>
        {e.caveat && <div className="mt-0.5">{e.caveat}</div>}
      </div>
    </motion.div>
  );
}

function CaseProof() {
  return (
    <Reveal className="mt-6">
      <BeamCard on c="var(--violet)" className="p-5">
        <div className="grid items-center gap-5 md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="label" style={{ color: 'var(--violet)' }}>
              It happens in real data
            </div>
            <div className="mt-1 text-[19px] font-extrabold leading-snug tracking-tight md:text-[22px]">
              In one real UK shop’s records, {CASE.accounts} of its best accounts went quiet. They had spent{' '}
              <span className="grad-text">{CASE.spendText}</span> the year before.
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
              Every pound traces to exact rows. One account is {CASE.topShare}% of that total with only{' '}
              {CASE.topOrders} orders in that year, which is why BlindSpot shows each account’s history, not
              just a big number.
            </p>
          </div>
          <QuietChart />
        </div>
      </BeamCard>
    </Reveal>
  );
}

/** A rising total with one bar's regular fading out underneath: the problem in one picture. */
function QuietChart() {
  const total = [42, 47, 45, 53, 58, 56, 63, 68, 72, 79];
  const regular = [14, 15, 13, 15, 14, 9, 5, 2, 0, 0];
  return (
    <div
      className="relative h-[150px]"
      aria-label="Total sales rise while one regular customer stops ordering"
    >
      <div className="absolute inset-0 flex items-end gap-1.5">
        {total.map((h, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col justify-end">
            <motion.div
              className="rounded-t"
              style={{ background: 'color-mix(in srgb, var(--sky) 55%, transparent)' }}
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 120, damping: 18 }}
            />
            <motion.div
              className="rounded-b"
              style={{ background: 'var(--amber)', boxShadow: '0 0 10px -2px var(--amber)' }}
              initial={{ height: 0, opacity: 0 }}
              whileInView={{ height: `${regular[i]}%`, opacity: regular[i] ? 1 : 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 + i * 0.06 }}
            />
          </div>
        ))}
      </div>
      <div className="absolute -top-1 right-0 flex gap-3 text-[10.5px] text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--sky)' }} /> Total sales
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--amber)' }} /> One regular
        </span>
      </div>
    </div>
  );
}

/** The answer: four steps, with the real replay outcome as proof the loop closes. */
export function SolutionLoop() {
  const sample = useOpenSample();
  const steps = [
    {
      icon: Search,
      c: 'var(--violet)',
      t: 'Find',
      d: 'The valuable customers who have gone quiet, each with their usual rhythm.',
    },
    {
      icon: ListChecks,
      c: 'var(--sky)',
      t: 'Decide',
      d: 'See the exact rows behind each one, then tick who to contact.',
    },
    {
      icon: PhoneCall,
      c: 'var(--amber)',
      t: 'Act',
      d: 'A short note for each, drafted by AI and checked before you see it. You send it, then log the day.',
    },
    {
      icon: RefreshCcw,
      c: 'var(--emerald)',
      t: 'Recheck',
      d: 'Upload a newer export. See who ordered after the list, and after each contact.',
    },
  ];
  return (
    <section className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 md:px-6" id="solution">
      <Reveal>
        <div className="label" style={{ color: 'var(--emerald)' }}>
          The solution
        </div>
        <h2 className="mt-1.5 max-w-3xl text-[26px] font-extrabold leading-[1.1] tracking-tight md:text-[38px]">
          Find who went quiet. Reach out. <span className="grad-text">See who came back.</span>
        </h2>
      </Reveal>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.t}>
            <motion.div
              whileHover={{ y: -4 }}
              className="panel card-live relative h-full overflow-hidden p-4"
              style={{ '--c': s.c } as CSSProperties}
            >
              <div className="card-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
              <div className="flex items-center gap-2">
                <motion.span
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: s.c, boxShadow: `0 0 22px -4px ${s.c}` }}
                  whileHover={{ rotate: -8, scale: 1.08 }}
                >
                  <s.icon size={16} color="white" />
                </motion.span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: s.c }}>
                  Step {i + 1}
                </span>
              </div>
              <div className="mt-2.5 text-[16px] font-extrabold">{s.t}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">{s.d}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-3">
        <div
          className="tint flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl px-4 py-3.5"
          style={{ '--c': 'var(--emerald)' } as CSSProperties}
        >
          <BadgeCheck size={18} style={{ color: 'var(--emerald)' }} />
          <div className="min-w-0 flex-[1_1_22rem] text-[13px]">
            <b>Historical replay, no outreach recorded:</b> a list made as of {CASE.replay.since} flagged{' '}
            {CASE.replay.listed} quiet top customers. In the shop’s real records, {CASE.replay.back} of them
            ordered again within {CASE.replay.days} days ({CASE.replay.salesText}).{' '}
            <span className="text-[var(--muted)]">
              Nobody was contacted, so this shows how the recheck works, not the effect of an email.
            </span>
          </div>
          <button
            className="btn btn-primary !h-9 text-[12.5px]"
            disabled={sample.busy !== null}
            onClick={() => sample.open('customers?practice=1')}
          >
            Try the loop on real data
            <ArrowRight size={13} />
          </button>
        </div>
      </Reveal>
    </section>
  );
}
