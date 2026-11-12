import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const dir = './.demo-frames/';
const html = `<!doctype html><canvas id=c width=1440 height=900></canvas><script>
window.encode = async () => {
  const frames = await (await fetch('/frames.json')).json();
  const imgs = await Promise.all(frames.map(f => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = '/f' + String(f.n).padStart(5,'0') + '.jpg'; })));
  const c = document.getElementById('c'), g = c.getContext('2d');
  g.drawImage(imgs[0], 0, 0, 1440, 900);
  const s = c.captureStream(30);
  const rec = new MediaRecorder(s, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5e6 });
  const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
  rec.start(1000);
  const t0 = performance.now(), base = frames[0].t;
  for (let k = 0; k < frames.length; k++) {
    const due = (frames[k].t - base) * 1000;
    const wait = due - (performance.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    g.drawImage(imgs[k], 0, 0, 1440, 900);
  }
  await new Promise(r => setTimeout(r, 800));
  rec.stop(); await new Promise(r => rec.onstop = r);
  const b = new Blob(chunks, { type: 'video/webm' });
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
};</script>`;
const srv = http.createServer((q, r) => {
  if (q.url === '/') { r.setHeader('content-type', 'text/html'); return r.end(html); }
  try { r.end(readFileSync(dir + q.url.slice(1))); } catch { r.statusCode = 404; r.end(); }
}).listen(8798);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:8798/');
p.setDefaultTimeout(400000);
const b64 = await p.evaluate(() => window.encode());
writeFileSync('docs/submission/demo-draft.webm', Buffer.from(b64, 'base64'));
await b.close(); srv.close();
console.log('bytes', Buffer.from(b64, 'base64').length);
