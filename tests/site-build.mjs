import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildSite, publicFiles } from '../tools/build-site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
buildSite({ root, check: true });
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-site-test-'));
try {
  fs.mkdirSync(path.join(fixture, 'v2'));
  for (const name of publicFiles) fs.copyFileSync(path.join(root, 'v2', name), path.join(fixture, 'v2', name));
  fs.writeFileSync(path.join(fixture, 'v2', 'private-session.json'), '{"synthetic":"must never be copied"}');
  buildSite({ root: fixture });
  assert.deepEqual(fs.readdirSync(path.join(fixture, 'docs')).sort(), [...publicFiles, '.nojekyll', 'site-manifest.json'].sort());
  buildSite({ root: fixture, check: true });
  const beforeCrlf = fs.readFileSync(path.join(fixture, 'docs', 'site-manifest.json'));
  for (const name of publicFiles) {
    const file = path.join(fixture, 'v2', name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
  }
  buildSite({ root: fixture });
  buildSite({ root: fixture, check: true });
  assert.ok(fs.readFileSync(path.join(fixture, 'docs', 'site-manifest.json')).equals(beforeCrlf), 'CRLF checkouts must produce the same published hashes as LF checkouts');
  for (const name of publicFiles) assert.ok(!fs.readFileSync(path.join(fixture, 'docs', name), 'utf8').includes('\r\n'), 'Published text must use LF');
  fs.appendFileSync(path.join(fixture, 'docs', 'app.mjs'), '\n// stale fixture\n');
  assert.throws(() => buildSite({ root: fixture, check: true }), /stale/);
  buildSite({ root: fixture });
  buildSite({ root: fixture, check: true });
  const unrelated = path.join(fixture, 'docs', 'unrelated.txt');
  fs.writeFileSync(unrelated, 'preserve this synthetic file');
  assert.throws(() => buildSite({ root: fixture }), /Unexpected docs file/);
  assert.throws(() => buildSite({ root: fixture, check: true }), /Unexpected docs file/);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'preserve this synthetic file');
  console.log('PASS deterministic public allowlist, manifest check, stale detection and unrelated-file preservation');
} finally {
  const safe = path.resolve(fixture);
  assert.ok(safe.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(safe).startsWith('hermes-site-test-'));
  fs.rmSync(safe, { recursive: true, force: true });
}

// Emulate Pages' repository prefix and serve only the generated artifact.
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain' };
const allowed = new Set([...publicFiles, '.nojekyll', 'site-manifest.json']);
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const prefix = '/hermes-soulmate/';
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const name = url.pathname.slice(prefix.length) || 'index.html';
  if (!allowed.has(name)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', `${mime[path.extname(name)] || 'text/plain'}; charset=utf-8`);
  res.end(fs.readFileSync(path.join(root, 'docs', name)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  const errors = [], external = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith(origin + '/') && !request.url().startsWith('blob:')) external.push(request.url());
    if (!request.url().startsWith('blob:')) requests.push({ url: request.url(), method: request.method(), body: request.postData() });
  });
  await page.goto(`${origin}/hermes-soulmate/`);
  await page.locator('#start').click();
  await page.locator('#answer').fill('PAGES_SYNTHETIC_VISITOR');
  await page.locator('[type=submit]').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hermes-soulmate-v2')));
  assert.equal(stored.answers['identity.name'], 'PAGES_SYNTHETIC_VISITOR');
  await page.reload();
  await page.locator('#review').click();
  assert.ok((await page.locator('.review').innerText()).includes('PAGES_SYNTHETIC_VISITOR'));
  await page.locator('#agent-open').click();
  const event = page.waitForEvent('download');
  await page.locator('#agent-kit').click();
  const kit = JSON.parse(fs.readFileSync(await (await event).path(), 'utf8'));
  assert.equal(kit.kind, 'hermes-agent-interview-kit');
  assert.equal(kit.session.answers['identity.name'], 'PAGES_SYNTHETIC_VISITOR');
  assert.ok(kit.questions.length > 100);
  assert.ok(kit.guide.includes('Instructions for the interviewing agent'));
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  for (const request of requests) {
    const url = new URL(request.url);
    const asset = url.pathname.slice('/hermes-soulmate/'.length) || 'index.html';
    assert.equal(request.method, 'GET', 'Answers must never be sent to any server, including same-origin');
    assert.equal(request.body, null, 'No answer payload may be sent');
    assert.equal(url.origin, origin);
    assert.ok(url.pathname.startsWith('/hermes-soulmate/') && allowed.has(asset), 'Only known static files may be fetched');
    assert.equal(url.search, '', 'Answer data must never be encoded in a query string');
    assert.ok(!request.url.includes('PAGES_SYNTHETIC_VISITOR'));
  }
  console.log('PASS generated project-prefix site: start, browser-only save/reload, review, agent kit; only static GETs, no answer payloads or external requests');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
