// Records the demo video from the running app (pnpm dev on :3000), then renders video/out/yapizza-demo.mp4.
// Run from the repo root: node video/make.cjs
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const BASE = 'http://localhost:3000';
const STAGE = BASE + '/__video/stage.html';
const MARK = BASE + '/brand/mark.svg';
const FLYERS = ['ycc-bulldog-block-party', 'ycc-coffee-shop-buyout', 'la-casa-super-bowl-lx', 'tas-tastes-of-taiwan', 'bakers-dozen-family-weekend', 'whiffenpoofs-jam-2026']
  .map((n) => ({ name: n + '.png', url: BASE + '/__video/flyers/' + n + '.png' }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const email = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/emails', f), 'utf8'));
const api = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json());

// Voiceover, one line per scene. Scene length is at least the line plus a beat.
const SCENES = [
  { id: 's01', min: 6.5, vo: "50 club emails a week, and the events are still half empty." },
  { id: 's02', min: 3, vo: "so we made Yapizza." },
  { id: 's03', min: 8, vo: "running a club? just forward your email." },
  { id: 's04', min: 9, vo: "already posted flyers on insta? drag them in." },
  { id: 's05', min: 5, vo: "room changed? the card just updates." },
  { id: 's06', min: 4, vo: "everything happening at Yale, one feed." },
  { id: 's07', min: 5, vo: "free food tonight? just ask." },
  { id: 's08', min: 4, vo: "every card links back to the original email." },
  { id: 's09', min: 5, vo: "add it to Google Calendar in one tap." },
  { id: 's10', min: 4, vo: "clubs see how many people saved their event." },
  { id: 's11', min: 5, vo: "clubs get a full room. you get your week back." },
];

async function recorder(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    const f = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ f, t: Date.now() / 1000 });
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const cuts = [];
  return {
    // Drop the stretch between cut() and resume(): waiting on the network, not the product.
    cut() { cuts.push([Date.now() / 1000 - t0, null]); },
    resume() { cuts[cuts.length - 1][1] = Date.now() / 1000 - t0; },
    async stop(file) {
      await sleep(300);
      await cdp.send('Page.stopScreencast');
      const end = Date.now() / 1000;
      const list = frames.map((fr, i) => `file '${fr.f}'\nduration ${((frames[i + 1]?.t ?? end) - (i === 0 ? t0 : fr.t)).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].f}'\n`;
      fs.writeFileSync(path.join(dir, 'list.txt'), list);
      const keep = cuts.length ? `select='${cuts.map(([a, b]) => `not(between(t,${a.toFixed(2)},${(b ?? 999).toFixed(2)}))`).join('*')}',setpts=N/30/TB,` : '';
      ff(['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', `fps=30,${keep}scale=1920:1080:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', file]);
    },
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const stageHtml = fs.readFileSync(path.join(__dirname, 'stage.html'));
  const browser = await chromium.launch();

  async function context(introSeen = true) {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 });
    await ctx.route('**/__video/stage.html', (r) => r.fulfill({ body: stageHtml, contentType: 'text/html' }));
    await ctx.route('**/__video/flyers/*', (r) => r.fulfill({ path: path.join(ROOT, 'fixtures/flyers', path.basename(new URL(r.request().url()).pathname)), contentType: 'image/png' }));
    await ctx.addInitScript(() => { const st = () => { const e = document.createElement('style'); e.textContent = 'nextjs-portal{display:none!important}'; document.documentElement.appendChild(e); }; if (document.documentElement) st(); else document.addEventListener('DOMContentLoaded', st); });
    if (introSeen) await ctx.addInitScript(() => { try { sessionStorage.setItem('yapizza:intro-seen', '1'); } catch {} });
    return ctx;
  }

  console.log('reset', (await api('/api/demo/reset')).detail);
  const ctx = await context();
  // Warm up dev compiles so no scene waits on them.
  { const p = await ctx.newPage(); for (const u of ['/', '/host/upload', '/host', '/ask']) { await p.goto(BASE + u); } await p.close(); }

  async function scene(id, layout, src, fn, c = ctx) {
    const page = await c.newPage();
    await page.goto(STAGE);
    await page.evaluate(([l, s]) => S.layout(l, s), [layout, src ? BASE + src : null]);
    if (src) { await page.frameLocator('#app').locator('body').waitFor(); await sleep(1200); }
    const app = page.frameLocator('#app');
    const rec = await recorder(page, path.join(OUT, 'frames', id));
    const s = SCENES.find((x) => x.id === id);
    await page.evaluate((t) => S.caption(t), s.vo);
    const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const click = async (loc, ms) => { const b = await box(loc); await page.evaluate(([x, y, m]) => S.move(x, y, m), [b.x, b.y, ms ?? 650]); await page.evaluate(() => S.ripple()); await page.mouse.click(b.x, b.y); };
    await fn({ page, app, rec, box, click });
    await rec.stop(path.join(OUT, id + '.mp4'));
    await page.close();
    console.log('captured', id);
  }

  // 1. Problem.
  const subs = fs.readdirSync(path.join(ROOT, 'fixtures/emails')).filter((f) => f.endsWith('.json')).map((f) => { const e = email(f); return [e.listName || e.from.split('<')[0].trim(), e.subject]; });
  await scene('s01', 'none', null, async ({ page }) => {
    await page.evaluate(([a, b]) => S.problem(a, b), [subs, [['[YUMS] weekly', 'Oct 26'], ['[YUMS] weekly', 'Nov 2'], ['[YUMS] weekly', 'Nov 9'], ['[YUMS] weekly', 'Nov 16'], ['[YUMS] weekly', 'Nov 23']]]);
    await sleep(900);
  });

  // 2. Intro, in a fresh session so it plays.
  { const c2 = await context(false); await scene('s02', 'full', null, async ({ page }) => { await page.evaluate((u) => S.layout('full', u), BASE + '/'); await sleep(3200); }, c2); await c2.close(); }

  // 3. A club forwards its weekly email; the cards land in the feed.
  const e34 = email('34-yums-weekly-nov-16.json');
  await scene('s03', 'split', '/', async ({ page, app, rec }) => {
    await page.evaluate((m) => S.mail(m), { subject: e34.subject, from: 'YUMS', date: 'Sun, Nov 15', body: e34.text.split('\n--')[0].trim(), mark: MARK });
    await page.evaluate(() => S.show(330, 700));
    await sleep(300);
    let b = await page.evaluate(() => S.box('#fwd')); await page.evaluate(([x, y]) => S.move(x, y), [b.x, b.y]); await page.evaluate(() => S.ripple());
    await page.evaluate(() => S.forward()); await sleep(300);
    b = await page.evaluate(() => S.box('.suggest div')); await page.evaluate(([x, y]) => S.move(x, y, 450), [b.x, b.y]); await page.evaluate(() => S.ripple()); await page.evaluate(() => S.pick());
    b = await page.evaluate(() => S.box('#send')); await page.evaluate(([x, y]) => S.move(x, y, 500), [b.x, b.y]); await page.evaluate(() => S.ripple());
    const sent = api('/api/demo/send-email', { fixture: '34-yums-weekly-nov-16.json' });
    await page.evaluate(() => S.send()); await page.evaluate(() => S.hide());
    await sleep(700); rec.cut();
    await sent;
    const card = app.getByRole('button', { name: /Putnam Problem Session/i }).first();
    await card.waitFor({ timeout: 60000 }); rec.resume();
    await card.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(2200);
  });

  // 4. Six Instagram flyers dragged onto the club upload page.
  await scene('s04', 'split', '/host/upload', async ({ page, app, rec }) => {
    await page.evaluate((f) => S.folder(f), FLYERS);
    await sleep(500);
    await page.evaluate(() => S.show(60, 120));
    await page.evaluate(() => S.move(48, 78, 400));
    await page.evaluate(() => S.band(48, 78, 570, 640, 900));
    await sleep(200);
    const zone = await app.locator('label:has([data-testid=upload-input])').boundingBox();
    await page.evaluate(([x, y]) => S.drag(x, y, 1100), [zone.x + zone.width / 2, zone.y + zone.height / 2]);
    await page.evaluate((f) => S.dropFiles(f), FLYERS);
    await page.evaluate(() => S.hide());
    await sleep(1500);
    await app.locator('[data-testid=upload-result]').evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 40, behavior: 'smooth' }));
    await sleep(1500); rec.cut();
    await page.waitForFunction(() => !document.querySelector('#app').contentDocument.querySelector('[data-testid=upload-result] [role=status]'), null, { timeout: 90000 }); rec.resume();
    await app.locator('[data-testid=upload-result] li').nth(3).evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(1600);
  });

  // 5. Room change: same card, new room.
  const e39 = email('39-yums-panel-room-change.json');
  await scene('s05', 'split', '/', async ({ page, app, rec }) => {
    await page.evaluate((m) => S.mail(m), { subject: e39.subject, from: 'YUMS', date: 'Tue, Nov 17', body: e39.text.split('\n--')[0].trim(), mark: MARK });
    const card = app.getByRole('button', { name: /Math Research Panel/ }).first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => S.show(330, 700));
    let b = await page.evaluate(() => S.box('#fwd')); await page.evaluate(([x, y]) => S.move(x, y, 450), [b.x, b.y]); await page.evaluate(() => { S.ripple(); return S.forward(); });
    b = await page.evaluate(() => S.box('.suggest div')); await page.evaluate(([x, y]) => S.move(x, y, 350), [b.x, b.y]); await page.evaluate(() => { S.ripple(); S.pick(); });
    b = await page.evaluate(() => S.box('#send')); await page.evaluate(([x, y]) => S.move(x, y, 350), [b.x, b.y]); await page.evaluate(() => S.ripple());
    const sent = api('/api/demo/room-change');
    await page.evaluate(() => S.send()); await page.evaluate(() => S.hide());
    rec.cut();
    await sent;
    await app.getByRole('button', { name: /Math Research Panel.*LC 102/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
    await app.getByRole('button', { name: /Math Research Panel/ }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await sleep(300);
    rec.resume();
    await sleep(2200);
  });

  // 6. Students: filters.
  await scene('s06', 'full', '/', async ({ app, click, page }) => {
    await page.evaluate(() => S.show(700, 700));
    await click(app.getByRole('button', { name: 'Free food', exact: true }));
    await sleep(1100);
    await page.evaluate(() => S.caption('')); await page.evaluate(() => S.hide()); await sleep(250); await page.screenshot({ path: path.join(OUT, 'feed.png') });
    await click(app.getByRole('button', { name: 'Free food', exact: true }), 300);
    await sleep(900);
  });

  // 7. Ask.
  await api('/api/demo/free-food-now');
  await scene('s07', 'full', '/', async ({ app, click, page, rec }) => {
    await page.evaluate(() => S.show(900, 600));
    const input = app.getByLabel('Ask Yapizza').first();
    await click(input);
    await input.pressSequentially('free food tonight', { delay: 55 });
    await input.press('Enter');
    rec.cut();
    await app.getByTestId('ask-result').first().waitFor({ timeout: 20000 }).catch(() => {});
    rec.resume();
    await page.evaluate(() => S.hide());
    await app.getByTestId('ask-result').first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' })).catch(() => {});
    await sleep(2600);
  });

  // 8. How this was read.
  await scene('s08', 'full', '/', async ({ app, click, page }) => {
    const card = app.getByRole('button', { name: /Math Research Panel/ }).first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => S.show(900, 650));
    await click(card, 500);
    await sleep(700);
    const drawer = app.getByRole('dialog').getByRole('button', { name: /How this was read/ });
    await drawer.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await click(drawer, 500);
    await page.evaluate(() => S.hide());
    await sleep(500);
    await app.getByRole('dialog').locator('mark').first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {});
    await sleep(1800);
  });

  // 9. Phone: Add to calendar, signed in as a demo student.
  await ctx.request.post(BASE + '/api/auth', { data: { userId: 'demo-1' } });
  await scene('s09', 'phone', '/', async ({ app, click, page }) => {
    const card = app.getByRole('button', { name: /Math Research Panel/ }).first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => S.show(900, 500));
    await click(card, 500);
    await sleep(700);
    await sleep(500);
    await click(app.getByRole('dialog').getByRole('button', { name: 'Add to calendar' }), 700);
    await page.evaluate(() => S.hide());
    await sleep(2800);
  });

  // 10. Host page: claim YUMS, show totals; then quick flashes.
  const hosts = await (await ctx.request.get(BASE + '/api/host/hosts?q=YUMS')).json();
  const yums = (hosts.hosts || []).find((h) => /YUMS/.test(h.name));
  if (yums) await ctx.request.post(BASE + '/api/host/claim', { data: { hostId: yums.id } });
  await scene('s10', 'full', '/host', async ({ page }) => {
    await sleep(1800);
    await page.evaluate(() => S.caption('')); await sleep(250); await page.screenshot({ path: path.join(OUT, 'host.png') }); await page.evaluate((t) => S.caption(t), SCENES[9].vo);
    for (const u of ['/digest', '/traditions', '/sales']) { await page.evaluate((x) => { document.querySelector('#app').src = x; }, BASE + u); await sleep(750); }
  });

  // 11. Close.
  await ctx.route('**/__video/shot/*', (r) => r.fulfill({ path: path.join(OUT, path.basename(new URL(r.request().url()).pathname)), contentType: 'image/png' }));
  await scene('s11', 'none', null, async ({ page }) => {
    await page.evaluate((m) => S.closeCard(m), { left: BASE + '/__video/shot/feed.png', right: BASE + '/__video/shot/host.png', mark: MARK });
    await sleep(1900);
    await page.evaluate(() => { S.caption(''); S.final(); });
    await sleep(3200);
  });
  await browser.close();

  // Assembly: each scene fills its slot; music under the whole cut.
  let t = 0; const parts = [];
  for (const s of SCENES) {
    const vidLen = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, s.id + '.mp4')]).toString();
    s.len = s.min; s.vid = vidLen; t += s.len;
    const fit = path.join(OUT, s.id + '-fit.mp4');
    const speed = vidLen > s.len ? `setpts=PTS*${(s.len / vidLen).toFixed(4)},` : '';
    ff(['-i', path.join(OUT, s.id + '.mp4'), '-vf', `${speed}fps=30,tpad=stop_mode=clone:stop_duration=${s.len}`, '-t', s.len.toFixed(3), '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', fit]);
    parts.push(`file '${fit}'`);
  }
  console.log(SCENES.map((s) => `${s.id} video ${s.vid.toFixed(1)}s slot ${s.len.toFixed(1)}s`).join('\n'), '\ntotal', t.toFixed(1));
  fs.writeFileSync(path.join(OUT, 'parts.txt'), parts.join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'parts.txt'), '-c', 'copy', path.join(OUT, 'video-only.mp4')]);
  const MUSIC = process.env.MUSIC || path.join(process.env.HOME, 'Downloads/Dominic Fike - White Keys.mp3');
  ff(['-i', path.join(OUT, 'video-only.mp4'), '-i', MUSIC, '-filter_complex', `[1:a]atrim=0:${t.toFixed(2)},afade=t=in:d=1,afade=t=out:st=${(t - 2).toFixed(2)}:d=2[aout]`, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(OUT, 'yapizza-demo.mp4')]);
  console.log('wrote', path.join(OUT, 'yapizza-demo.mp4'));
}

main().catch((e) => { console.error(e); process.exit(1); });
