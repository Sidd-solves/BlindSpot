import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const script = readFileSync('docs/submission/VIDEO_SCRIPT.md', 'utf8');
const lines = [...script.matchAll(/^> "(.*)"$/gm)].map((m) => m[1]);
const vdir = './.demo-frames/';
mkdirSync(vdir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
rmSync(vdir, { recursive: true, force: true }); mkdirSync(vdir, { recursive: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  const n = frames.length;
  writeFileSync(`${vdir}f${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  frames.push({ n, t: f.metadata.timestamp });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 72, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
const T0 = Date.now();
const at = async (sec) => { const w = T0 + sec * 1000 - Date.now(); if (w > 0) await p.waitForTimeout(w); };
const cap = async (i, whole = false) => p.evaluate(([t, secs, whole]) => {
  let el = document.getElementById('__cap');
  if (!el) {
    el = document.createElement('div'); el.id = '__cap';
    Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', maxWidth: '1300px', zIndex: 99999,
      padding: '12px 20px', borderRadius: '14px', background: 'rgba(8,8,20,.82)', color: '#fff', font: '800 40px/1.25 Manrope, system-ui, sans-serif',
      textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.12)', pointerEvents: 'none' });
    document.body.appendChild(el);
  }
  // One sentence at a time, each shown for a share of the scene proportional to its words.
  clearTimeout(window.__capT);
  const sentences = t.match(/[^.!?:]+[.!?:]+["”]?|[^.!?:]+$/g).map((x) => x.trim()).filter(Boolean);
  // Long sentences are split at a comma or dash near the middle, so a caption is at most two short lines on a phone.
  const parts = whole ? [t] : sentences.flatMap((x) => {
    const w = x.split(/\s+/);
    if (w.length <= 12) return [x];
    const cuts = [...x.matchAll(/[,—–]\s/g)].map((m) => m.index + 1);
    if (!cuts.length) return [x.split(/\s+/).slice(0, Math.ceil(w.length / 2)).join(' '), x.split(/\s+/).slice(Math.ceil(w.length / 2)).join(' ')];
    const mid = x.length / 2, c = cuts.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
    return [x.slice(0, c).trim(), x.slice(c).trim()];
  });
  const words = parts.map((x) => x.split(/\s+/).length), total = words.reduce((a, b) => a + b, 0);
  let k = 0;
  const show = () => {
    el.textContent = parts[k];
    if (k < parts.length - 1) window.__capT = setTimeout(() => { k++; show(); }, (words[k] / total) * secs * 1000);
  };
  show();
}, [lines[i], SLOTS[i], whole]);
const SLOTS = [14, 16, 15, 23, 22, 20, 35, 13, 7];
const log = [];
const mark = (l) => log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${l}`);
// 0:00 hook
await p.goto('http://localhost:5173/'); await p.getByText('goodbye.').first().waitFor(); await cap(0); mark('hook');
await at(14);
// 0:14 why it matters
await cap(1);
// Hold on the one statistic the narration names (29.0% vs 7.7%), centred on screen.
await p.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent?.trim().startsWith('Repeat revenue and profit'));
  el?.closest('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
mark('why'); await at(30);
// 0:30 meet
await cap(2); await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await p.waitForTimeout(900);
await p.getByText('See it on a real shop').first().click(); await p.waitForTimeout(5000); mark('overview'); await at(45);
// 0:45 find
await cap(3); await p.evaluate(() => (location.hash = '/customers'));
await p.getByText(/top customers with no order in 90 days/).waitFor({ timeout: 60000 }); mark('find'); await at(68);
// 1:08 evidence
await cap(4);
const panel = p.getByText('This rule, tested on this shop’s past');
await panel.scrollIntoViewIfNeeded(); mark('evidence'); await at(90);
// 1:30 decide & act
await cap(5); await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await p.waitForTimeout(600);
const rows = p.locator('button[aria-pressed]');
for (let i = 2; i < 6; i++) { await rows.nth(i).click({ force: true }); await p.waitForTimeout(250); }
await p.getByRole('button', { name: /Start a list with 4/ }).click({ force: true }); await p.waitForTimeout(700);
await p.locator('button[aria-expanded]').nth(0).click({ force: true }); await p.waitForTimeout(500);
const ai = p.getByRole('button', { name: /Write with AI/ }).first();
if (await ai.count()) { await ai.click(); await p.getByText(/Written by AI|failed its checks/).first().waitFor({ timeout: 90000 }); mark('ai note'); }
await p.getByRole('button', { name: 'Contacted' }).first().click({ force: true }); mark('contacted'); await at(110);
// 1:50 recheck (practice)
await cap(6);
await p.getByRole('button', { name: 'New list' }).click({ force: true }); await p.waitForTimeout(500);
await p.getByText('Practice on past data', { exact: true }).first().click({ force: true });
await p.getByText(/Historical replay\./).waitFor({ timeout: 60000 }); await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'Select all' }).click({ force: true }); await p.waitForTimeout(500);
await p.getByRole('button', { name: /Start a list with/ }).click({ force: true }); await p.waitForTimeout(2500);
await p.getByRole('button', { name: /Check the shop/ }).click({ force: true });
await p.getByText(/listed had a recorded later order/).waitFor({ timeout: 60000 }); mark('recheck'); await at(145);
// 2:25 what changes: saved lists
await cap(7);
// Open the saved-list picker so both lists (the real one and the practice run) are on screen.
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await p.waitForTimeout(500);
await p.locator('button', { hasText: /^Practice run · / }).first().click({ force: true });
mark('lists'); await at(158);
// 2:38 close
// Straight to the site home (no app page in between), with the whole closing line on screen at once.
await p.evaluate(() => { location.hash = ''; window.scrollTo(0, 0); });
await cap(8, true); mark('close'); await at(165);
await cdp.send('Page.stopScreencast');
writeFileSync(`${vdir}frames.json`, JSON.stringify(frames));
await ctx.close(); await b.close();
console.log('frames', frames.length);
console.log(log.join('\n'));
console.log('total', ((Date.now() - T0) / 1000).toFixed(1));
