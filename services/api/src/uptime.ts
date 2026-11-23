/**
 * Render's free plan puts a server to sleep after 15 minutes without inbound requests; the next visitor waits 30–60
 * seconds while it wakes. Render tells the server its own public URL (RENDER_EXTERNAL_URL); requesting it goes out
 * through Render's proxy and back in, which counts as a visit and keeps the service awake.
 *
 * Free instance hours are capped at 750 a month, so the server only keeps itself awake from 6 AM to midnight US
 * Central (12:00–06:00 UTC), about 558 hours in a 31-day month. Overnight it sleeps and wakes on the first visit.
 * November 2026 ran short on hours, so self-pinging starts on Dec 1 2026; until then the site sleeps whenever idle.
 */
const START = Date.UTC(2026, 11, 1);

export function inAwakeWindow(now = new Date()) {
  if (now.getTime() < START) return false;
  const h = now.getUTCHours();
  return h >= 12 || h < 6;
}

export function keepAwake(log: (message: string) => void) {
  const base = process.env.KEEP_AWAKE_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (!base) return;
  const url = `${base.replace(/\/$/, '')}/api/health?keepawake=1`;
  const ping = () => {
    if (!inAwakeWindow()) return;
    fetch(url, { signal: AbortSignal.timeout(30_000) })
      .then((r) => {
        if (!r.ok) log(`keep-awake: HTTP ${r.status}`);
      })
      .catch((e) => log(`keep-awake failed: ${e?.message}`));
  };
  setInterval(ping, 10 * 60_000).unref();
  setTimeout(ping, 60_000).unref();
  log(`keep-awake: pinging ${url} every 10 minutes, 12:00–06:00 UTC, from Dec 1 2026`);
}
