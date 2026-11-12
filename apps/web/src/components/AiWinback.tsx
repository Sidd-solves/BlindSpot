import { AnimatePresence, motion } from 'framer-motion';
import { useState, type CSSProperties } from 'react';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { post } from '../api';
import { useStore } from '../store';
import { Markdown } from './ui';
import { highlighter, type FactCheckResult } from './FactCheck';

interface Draft {
  subject: string;
  body: string;
  why: string;
  factCheck: FactCheckResult;
  checks?: { passed: boolean; corrected: boolean };
}
interface Fallback {
  fallback: true;
  problems: string[];
  message: string;
}

/** The plain draft, plus a "Write with AI" version personalised from what this customer bought. Nothing is sent. */
export function AiWinback({
  customer,
  shopName,
  template,
  asOf,
}: {
  customer: string;
  shopName: string;
  template: string;
  /** For a replay list: the day the list was read as of. */
  asOf?: string;
}) {
  const { health } = useStore();
  const [d, setD] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const text = d ? `Subject: ${d.subject}\n\n${d.body}` : template;
  const write = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<Draft | Fallback>('/api/ai/winback', {
        customer,
        shopName,
        ...(asOf ? { asOf } : {}),
      });
      if ('fallback' in r) {
        setD(null);
        setErr(`${r.message} What failed: ${r.problems.join(' ')}`);
      } else setD(r);
    } catch (e: any) {
      setErr(e?.message ?? 'Writing failed.');
    }
    setBusy(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the text is still visible */
    }
  };
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={d ? 'ai' : 'plain'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {d && (
            <div
              className="mb-1 flex items-center gap-1 text-[11px] font-bold"
              style={{ color: 'var(--fuchsia)' }}
            >
              <Sparkles size={11} /> Written by AI · {d.subject}
              {d.checks?.passed && (
                <span
                  className="ml-1 font-semibold"
                  style={{ color: 'var(--emerald)' }}
                  title="Checked: no amounts, order counts or dates; no discounts; doesn't say they left; product names are filled in from this customer's own purchases, and other products from the shop's catalogue are rejected. Not checked: a product name the shop doesn't sell. Read it before sending."
                >
                  · checked{d.checks.corrected ? ' after one rewrite' : ''}: no amounts, dates or discounts;
                  their own products
                </span>
              )}
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-[12px] leading-snug">
            {d ? d.body : template}
          </pre>
          {d && (
            <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">
              <b>Why this customer:</b> <Markdown text={d.why} mark={highlighter(d.factCheck)} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {err && (
        <div role="alert" className="mt-1 text-[11.5px]" style={{ color: 'var(--rose)' }}>
          {err}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <motion.button whileTap={{ scale: 0.95 }} className="btn !h-7 text-[11.5px]" onClick={copy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy message'}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn !h-7 text-[11.5px]"
          style={{ '--c': 'var(--fuchsia)' } as CSSProperties}
          onClick={write}
          disabled={!health?.ai || busy}
          title={health?.ai ? undefined : 'Needs a Claude API key on the server'}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {busy ? 'Writing…' : d ? 'Write another' : 'Write with AI'}
        </motion.button>
      </div>
    </>
  );
}
