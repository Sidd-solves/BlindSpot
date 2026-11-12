import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Compass, Eye, Sparkles } from 'lucide-react';
import { createStory, seg, type StoryFrame } from './engine';
import { useOpenSample } from '../Start';
import { ProblemEvidence, SolutionLoop } from '../Problem';
import { RowRiver } from '../RowRiver';
import { HorizontalGallery, PinnedStory, ProofTicker } from '../Scroll';
import { Marquee } from '../Effects';
import { CATCHES } from '../content';
import { CAT } from '../../api';
import { RealResults, StepsTeaser } from '../Home';

/**
 * The page, top to bottom. Cinematic stretches (empty, tall) move the camera a long way; reading stretches hold the
 * camera almost still inside the realm they belong to while the real sections scroll over it.
 * `a`..`b` is the stretch of the journey (0 to 1) each block covers.
 */
type Block = { a: number; b: number } & ({ vh: number } | { id: string; c: string; tag: string; node: ReactNode });
const SEQ: Block[] = [
  { a: -0.03, b: 0.03, vh: 100 },
  { a: 0.03, b: 0.045, id: 'problem', c: 'var(--amber)', tag: 'The problem', node: <ProblemEvidence /> },
  { a: 0.045, b: 0.2, vh: 230 },
  { a: 0.2, b: 0.29, vh: 120 },
  { a: 0.29, b: 0.32, id: 'rows', c: 'var(--violet)', tag: 'Inside your rows', node: <RowRiver /> },
  { a: 0.32, b: 0.4, vh: 90 },
  { a: 0.4, b: 0.57, vh: 230 },
  {
    a: 0.57,
    b: 0.585,
    id: 'checks',
    c: 'var(--cyan)',
    tag: 'What it checks',
    node: (
      <>
        <section className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
          <div className="label mb-2 text-center">Ten areas checked whenever your data allows</div>
          <Marquee items={CATCHES.map((c) => ({ t: c.t, c: CAT[c.k].c }))} />
        </section>
        <PinnedStory />
      </>
    ),
  },
  { a: 0.585, b: 0.735, vh: 240 },
  {
    a: 0.735,
    b: 0.748,
    id: 'loop',
    c: 'var(--amber)',
    tag: 'What you do with it',
    node: (
      <>
        <ProofTicker />
        <SolutionLoop />
      </>
    ),
  },
  { a: 0.748, b: 0.86, vh: 190 },
  { a: 0.86, b: 0.872, id: 'gallery', c: 'var(--fuchsia)', tag: 'Everything it finds', node: <HorizontalGallery /> },
  { a: 0.872, b: 0.9, vh: 70 },
  {
    a: 0.9,
    b: 0.93,
    id: 'results',
    c: 'var(--emerald)',
    tag: 'Proof',
    node: (
      <>
        <StepsTeaser />
        <RealResults />
      </>
    ),
  },
  { a: 0.93, b: 1.04, vh: 150 },
];

/** The twelve checks you fly past in the tunnel, in the realm colour of the stretch they sit in. */
const CHECKS: [string, string][] = [
  ['Repeat rate', 'var(--violet)'],
  ['Lapsed VIPs', 'var(--violet)'],
  ['Cohorts', 'var(--violet)'],
  ['New vs returning', 'var(--violet)'],
  ['Pareto', 'var(--cyan)'],
  ['Product decay', 'var(--cyan)'],
  ['Stock gaps', 'var(--cyan)'],
  ['Basket size', 'var(--cyan)'],
  ['Refunds', 'var(--amber)'],
  ['Returns', 'var(--amber)'],
  ['Price drift', 'var(--amber)'],
  ['Anomalies', 'var(--amber)'],
];
const ANCHORS = CHECKS.map((_, i): [number, number, number] => {
  const a = i * 2.4 + 0.6;
  return [Math.cos(a) * 2.7, Math.sin(a) * 2.1, -78 - i * 8.2];
});
const REALMS: [string, string, number][] = [
  ['Customers', 'var(--violet)', 0.4],
  ['Products', 'var(--cyan)', 0.45],
  ['Money', 'var(--amber)', 0.515],
];
const CHAPTERS: [string, number][] = [
  ['Dashboard', 0],
  ['The problem', 0.035],
  ['Dive', 0.12],
  ['Rows', 0.25],
  ['Inside your rows', 0.295],
  ['Checks', 0.47],
  ['What it checks', 0.572],
  ['Blind spot', 0.68],
  ['What you do', 0.737],
  ['Break out', 0.79],
  ['Shatter', 0.835],
  ['Everything it finds', 0.862],
  ['Proof', 0.903],
  ['Start', 0.96],
];
const DIVE = [['BUT', 'IT’S', 'NOT'], ['TELLING', 'YOU'], ['EVERYTHING']];
const REVEAL = '10 of your best customers stopped ordering.';
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789£%#';
const scramble = (s: string, k: number) => {
  const n = Math.floor(k * s.length);
  let out = s.slice(0, n);
  for (let i = n; i < s.length; i++) out += s[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
  return out;
};
const band = (p: number, a: number, b: number, f = 0.025) => Math.min(seg(p, a - f, a), 1 - seg(p, b, b + f));

export default function Story() {
  const sample = useOpenSample();
  const blocks = useRef<(HTMLDivElement | null)[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const dive = useRef<HTMLDivElement>(null);
  const words = useRef<(HTMLSpanElement | null)[]>([]);
  const rows = useRef<HTMLDivElement>(null);
  const rowsN = useRef<HTMLSpanElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const realm = useRef<HTMLDivElement>(null);
  const checksN = useRef<HTMLSpanElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const reveal = useRef<HTMLDivElement>(null);
  const revealT = useRef<HTMLDivElement>(null);
  const out = useRef<HTMLDivElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const engine = useRef<ReturnType<typeof createStory> | null>(null);
  const [load, setLoad] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('scene-on');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastReveal = -1;
    let keepNow = 1;
    const show = (el: HTMLElement | null, o0: number, extra = '', always = false) => {
      if (!el) return;
      const o = always ? o0 : o0 * keepNow;
      el.style.opacity = String(o);
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
      if (extra) el.style.transform = extra;
    };
    const progress = () => {
      const mid = innerHeight * 0.5;
      let p = 0,
        after = 0,
        dim = 0;
      const els = blocks.current;
      for (let i = 0; i < SEQ.length; i++) {
        const el = els[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const { a, b } = SEQ[i];
        if (r.top <= mid && r.bottom > mid) p = a + (b - a) * ((mid - r.top) / r.height);
        if (i === SEQ.length - 1 && r.bottom <= mid) {
          p = b;
          after = (mid - r.bottom) / innerHeight;
        }
        if (i === 0 && r.top > mid) p = a;
        if ('node' in SEQ[i]) {
          const cover = (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / innerHeight;
          dim = Math.max(dim, sstepJs(Math.min(1, Math.max(0, cover / 0.32))));
        }
      }
      return { p: Math.min(1, Math.max(0, p)), after, dim };
    };
    const onFrame = ({ p, after, dim: dm, labels }: StoryFrame) => {
      keepNow = 1 - dm;
      show(hint.current, 1 - seg(p, 0, 0.02), '', true);
      // dive: the words spread apart and rush past
      const dk = seg(p, 0.085, 0.2);
      show(dive.current, Math.min(seg(p, 0.075, 0.1), 1 - seg(p, 0.175, 0.2)));
      let wi = 0;
      DIVE.forEach((line, li) =>
        line.forEach((_, i) => {
          const el = words.current[wi++];
          if (!el) return;
          const cx = i - (line.length - 1) / 2,
            cy = li - 1;
          const s = 1 + dk * dk * 3.2;
          el.style.transform = `translate3d(calc(${cx * dk * dk * 46}vw + ${cx * (s - 1) * 3.4}em), ${cy * dk * dk * 30}vh, 0) scale(${s})`;
        }),
      );
      // rows
      show(rows.current, band(p, 0.225, 0.385));
      if (rowsN.current) rowsN.current.textContent = Math.round(261658 * sstepJs(seg(p, 0.21, 0.32))).toLocaleString('en-GB');
      // tunnel
      const tk = seg(p, 0.4, 0.6);
      show(hud.current, band(p, 0.405, 0.595));
      const rIdx = p < REALMS[1][2] ? 0 : p < REALMS[2][2] ? 1 : 2;
      if (realm.current && realm.current.dataset.r !== String(rIdx)) {
        realm.current.dataset.r = String(rIdx);
        realm.current.textContent = REALMS[rIdx][0];
        realm.current.style.setProperty('--c', REALMS[rIdx][1]);
        realm.current.animate(
          [
            { transform: 'translateY(8px) scale(.9)', opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
      const nChecks = Math.round(tk * 40);
      if (checksN.current) checksN.current.textContent = String(nChecks);
      if (ring.current) ring.current.style.strokeDashoffset = String(113 * (1 - tk));
      labels.forEach((l, i) => {
        const el = chips.current[i];
        if (!el) return;
        const d = l.d;
        const o = d >= -0.5 || p < 0.36 || p > 0.62 ? 0 : Math.min(seg(d, -44, -30), seg(-d, 0.5, 6)) * keepNow;
        const near = 1 - Math.min(1, -d / 44);
        el.style.opacity = String(o);
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        el.style.transform = `translate3d(${l.x}px, ${l.y}px, 0) translate(-50%, -50%) scale(${0.5 + near * near * 1.6})`;
      });
      // reveal
      const rk = band(p, 0.655, 0.765, 0.02);
      show(reveal.current, rk, `translate3d(0, ${(1 - seg(p, 0.64, 0.68)) * 20}px, 0)`);
      const dk2 = seg(p, 0.665, 0.715);
      if (revealT.current && (dk2 !== lastReveal || dk2 < 1)) {
        lastReveal = dk2;
        revealT.current.textContent = scramble(REVEAL, dk2);
      }
      show(out.current, band(p, 0.79, 0.83, 0.012));
      const finO = seg(p, 0.885, 0.93) * (1 - Math.min(1, after * 1.6));
      show(fin.current, finO, `translate3d(0, ${(1 - seg(p, 0.88, 0.94)) * 30}px, 0) scale(${0.96 + 0.04 * seg(p, 0.88, 0.94)})`);
      // rail
      show(rail.current, 1 - Math.min(1, after * 2), '', true);
      const cur = CHAPTERS.reduce((acc, [, at], i) => (p + 0.02 >= at ? i : acc), 0);
      dots.current.forEach((d, i) => d && (d.dataset.on = String(i === cur)));
    };
    const e = createStory(canvas.current!, { progress, labels: ANCHORS, still, onFrame });
    engine.current = e;
    // the loader: counts to 100 while fonts and textures settle
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / (still ? 200 : 1500));
      setLoad(Math.round(100 * (1 - Math.pow(1 - k, 2.2))));
      if (k < 1) raf = requestAnimationFrame(tick);
      else {
        setReady(true);
        e.begin();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      e.destroy();
      document.documentElement.classList.remove('scene-on');
    };
  }, []);

  const jump = (at: number) => {
    const i = SEQ.findIndex((b) => at >= b.a && at < b.b);
    const el = blocks.current[Math.max(0, i)];
    if (!el) return;
    const b = SEQ[Math.max(0, i)];
    const r = el.getBoundingClientRect();
    const y = r.top + scrollY + ((at - b.a) / (b.b - b.a)) * r.height - innerHeight * 0.5;
    scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };
  let wi = 0;

  return (
    <>
      {createPortal(
        <>
          <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
          <div className="story-ui pointer-events-none fixed inset-0 z-20 overflow-hidden">
            {/* dive words */}
            <div ref={dive} className="absolute inset-0 grid place-items-center" style={{ opacity: 0 }}>
              <div className="text-center text-[clamp(30px,6vw,84px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-white">
                {DIVE.map((line, li) => (
                  <div key={li} className="flex justify-center gap-[0.28em]">
                    {line.map((w) => {
                      const idx = wi++;
                      return (
                        <span key={w} ref={(el) => (words.current[idx] = el)} className="inline-block will-change-transform">
                          {w}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* rows */}
            <div ref={rows} className="absolute bottom-8 left-4 md:left-10" style={{ opacity: 0 }}>
              <div className="story-glass w-[270px] rounded-2xl p-3.5">
                <div className="label">Reading your sales</div>
                <div className="mt-1 text-[30px] font-extrabold tabular-nums tracking-tight">
                  <span ref={rowsN}>0</span>
                  <span className="ml-1.5 text-[13px] font-bold text-[var(--muted)]">rows</span>
                </div>
                <div className="mt-1 text-[11.5px] leading-snug text-[var(--muted)]">
                  Every order in your export, cleaned and read. A million rows takes about six seconds.
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--muted)]">
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full" style={{ background: 'var(--violet)', boxShadow: '0 0 8px var(--violet)' }} />
                    a sale
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />
                    a customer going quiet
                  </span>
                </div>
              </div>
            </div>

            {/* tunnel hud */}
            <div ref={hud} className="absolute inset-x-0 top-[118px] flex justify-center md:top-24" style={{ opacity: 0 }}>
              <div ref={realm} data-r="-1" className="chip !px-3 !py-1 text-[12px]" style={{ '--c': 'var(--violet)', backdropFilter: 'blur(10px)' } as CSSProperties} />
            </div>
            <ChecksDial hudRef={hud} nRef={checksN} ringRef={ring} />
            {CHECKS.map(([name, c], i) => (
              <div
                key={name}
                ref={(el) => (chips.current[i] = el)}
                className="story-chip absolute left-0 top-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold will-change-transform"
                style={{ '--c': c, opacity: 0 } as CSSProperties}
              >
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                {name}
              </div>
            ))}

            {/* reveal */}
            <div ref={reveal} className="absolute inset-x-0 bottom-[12vh] flex flex-col items-center px-4 text-center" style={{ opacity: 0 }}>
              <div className="chip !py-1" style={{ '--c': 'var(--amber)' } as CSSProperties}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--amber)' }} />
                The blind spot
              </div>
              <div ref={revealT} className="mt-3 min-h-[1.2em] max-w-[22ch] font-mono text-[clamp(15px,2vw,24px)] font-bold tracking-tight text-white md:max-w-none" />
              <div className="mt-1.5 text-[12px] text-[var(--muted)]">A year of their orders, gone quiet while the total kept rising.</div>
            </div>
            <div ref={out} className="absolute inset-x-0 top-24 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]" style={{ opacity: 0 }}>
              Every finding comes with its rows
            </div>

            {/* finale */}
            <div ref={fin} className="absolute inset-0 grid place-items-center px-4" style={{ opacity: 0 }}>
              <div className="text-center">
                <div className="text-[clamp(40px,7.5vw,104px)] font-extrabold leading-[0.95] tracking-[-0.04em]">
                  See your
                  <br />
                  <span className="story-grad bg-clip-text text-transparent">blind spot.</span>
                </div>
                <p className="mx-auto mt-4 max-w-md text-[14px] text-[var(--muted)]">
                  Dashboards show what happened. BlindSpot shows what you’re missing. Upload a sales export and see your
                  first findings in under a minute.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button className="btn btn-primary !h-11 !px-5 text-[13px]" onClick={() => sample.open('overview')}>
                    <Eye size={15} />
                    See it on a real shop
                  </button>
                  <button className="btn !h-11 !px-5 text-[13px]" onClick={() => (location.hash = '/signup')}>
                    Start free
                    <ArrowRight size={14} />
                  </button>
                  <button className="btn !h-11 !px-4 text-[13px]" onClick={() => sample.open('overview?tour=1')}>
                    <Compass size={15} style={{ color: 'var(--cyan)' }} />
                    60-second tour
                  </button>
                </div>
              </div>
            </div>

            {/* chapter rail */}
            <div ref={rail} className="absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col gap-2.5 md:flex">
              {CHAPTERS.map(([name, at], i) => (
                <button
                  key={name}
                  ref={(el) => (dots.current[i] = el)}
                  onClick={() => jump(at)}
                  className="story-dot pointer-events-auto group flex items-center justify-end gap-2"
                  aria-label={name}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-0 transition-opacity group-hover:opacity-100">{name}</span>
                  <i />
                </button>
              ))}
            </div>
          </div>

          {/* loader */}
          <div
            className="fixed inset-0 z-[60] grid place-items-center bg-[#04040a] transition-[clip-path] duration-[900ms] ease-[cubic-bezier(.7,0,.2,1)]"
            style={{ clipPath: ready ? 'inset(0 0 100% 0)' : 'inset(0 0 0% 0)' }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${load}%`, background: 'linear-gradient(90deg, var(--violet), var(--cyan), var(--amber))' }} />
              </div>
              <div className="font-mono text-[11px] tracking-[0.3em] text-[var(--muted)]">{String(load).padStart(3, '0')}</div>
            </div>
          </div>
        </>,
        document.body,
      )}
      {/* the page: cinematic stretches and the real sections, in order */}
      <div className="-mt-20">
        {SEQ.map((b, i) =>
          'vh' in b ? (
            <div key={i} ref={(el) => (blocks.current[i] = el)} className="relative" style={{ height: `${b.vh}vh` }}>
              {i === 0 && (
                <>
            {/* hero */}
            <div ref={hero} className="absolute inset-0 flex items-start px-4 pt-28 md:items-center md:px-10 md:pt-0">
              <div className="mx-auto w-full max-w-6xl">
                <div className="max-w-[460px]">
                  <div className="chip !py-1" style={{ '--c': 'var(--violet)', backdropFilter: 'blur(10px)' } as CSSProperties}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--emerald)', boxShadow: '0 0 8px var(--emerald)' }} />
                    For independent online shops
                  </div>
                  <h1 className="story-rise mt-4 text-[clamp(34px,4.8vw,62px)] font-extrabold leading-[0.98] tracking-[-0.035em]">
                    Your dashboard
                    <br />
                    says you’re{' '}
                    <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">fine.</span>
                  </h1>
                  <p className="story-rise mt-4 max-w-md text-[13.5px] leading-relaxed text-[var(--muted)]" style={{ animationDelay: '.15s' }}>
                    Your best customers don’t say goodbye. They just stop ordering, while the total still looks
                    fine. BlindSpot reads your sales export, finds the valuable customers who have gone quiet, shows
                    the exact rows behind each one, and helps you win them back.
                  </p>
                  <div className="story-rise mt-5 flex flex-wrap gap-2" style={{ animationDelay: '.3s' }}>
                    <button className="btn btn-primary !h-10 !px-4 text-[12.5px]" onClick={() => sample.open('overview')}>
                      <Eye size={14} />
                      See it on a real shop
                    </button>
                    <button className="btn !h-10 !px-4 text-[12.5px]" onClick={() => (location.hash = '/signup')}>
                      <Sparkles size={14} style={{ color: 'var(--fuchsia)' }} />
                      Create a free account
                    </button>
                    <button className="btn !h-10 !px-3.5 text-[12.5px]" onClick={() => sample.open('overview?tour=1')}>
                      <Compass size={14} style={{ color: 'var(--cyan)' }} />
                      60-second tour
                    </button>
                  </div>
                  <div className="story-rise mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--muted)]" style={{ animationDelay: '.45s' }}>
                    {['Free to try', 'Guest mode, no sign-up', 'Read-only access'].map((t) => (
                      <span key={t} className="flex items-center gap-1.5">
                        <i className="h-1 w-1 rounded-full" style={{ background: 'var(--emerald)', boxShadow: '0 0 6px var(--emerald)' }} />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div ref={hint} className="pointer-events-none absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">
              Scroll to dive in
              <span className="story-hint relative block h-9 w-px overflow-hidden bg-white/10" />
            </div>

                </>
              )}
            </div>
          ) : (
            <div key={b.id} ref={(el) => (blocks.current[i] = el)} className="story-read relative" style={{ '--c': b.c } as CSSProperties}>
              <div className="story-read-bg pointer-events-none absolute inset-0" />
              <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 pt-10 md:px-6">
                <span className="h-px flex-1 story-read-line" />
                <span className="label" style={{ color: b.c }}>
                  {b.tag}
                </span>
                <span className="h-px flex-1 story-read-line" style={{ transform: 'scaleX(-1)' }} />
              </div>
              <div className="relative">{b.node}</div>
            </div>
          ),
        )}
      </div>
    </>
  );
}

function sstepJs(x: number) {
  return x * x * (3 - 2 * x);
}

/** Checks counter with a filling ring, bottom right during the tunnel. */
function ChecksDial({
  hudRef,
  nRef,
  ringRef,
}: {
  hudRef: React.RefObject<HTMLDivElement>;
  nRef: React.RefObject<HTMLSpanElement>;
  ringRef: React.RefObject<SVGCircleElement>;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // mirror the HUD's visibility
    let raf = 0;
    const sync = () => {
      if (box.current && hudRef.current) box.current.style.opacity = hudRef.current.style.opacity;
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [hudRef]);
  return (
    <div ref={box} className="absolute bottom-8 right-4 md:right-14" style={{ opacity: 0 }}>
      <div className="story-glass flex items-center gap-3 rounded-2xl p-3 pr-4">
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4" />
          <circle
            ref={ringRef}
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="url(#chk)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="113"
            strokeDashoffset="113"
          />
          <defs>
            <linearGradient id="chk" x1="0" x2="1">
              <stop offset="0" stopColor="#8b5cf6" />
              <stop offset=".5" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
        <div>
          <div className="text-[22px] font-extrabold tabular-nums leading-none">
            <span ref={nRef}>0</span>
            <span className="text-[13px] text-[var(--muted)]"> / 40</span>
          </div>
          <div className="label mt-1">Checks run</div>
          <div className="mt-0.5 max-w-[170px] text-[10.5px] leading-snug text-[var(--muted)]">Each finding is tested by statistics before you see it.</div>
        </div>
      </div>
    </div>
  );
}
