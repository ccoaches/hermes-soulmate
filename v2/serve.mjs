#!/usr/bin/env node
// Read-only, loopback-only preview. Only the public wizard assets are served.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/interview.mjs', ['interview.mjs', 'text/javascript']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/questions.json', ['questions.json', 'application/json']],
  ['/START-HERE.md', ['START-HERE.md', 'text/plain']],
  ['/RESEARCH.md', ['RESEARCH.md', 'text/plain']],
]);

export function createWizardServer() {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const address = request.socket.localPort;
    if (request.headers.host !== `127.0.0.1:${address}`) {
      response.writeHead(403).end('Use the local wizard address printed in the terminal.');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Read-only preview.');
      return;
    }
    let pathname;
    try { pathname = new URL(request.url, `http://127.0.0.1:${address}`).pathname; }
    catch { response.writeHead(400).end('Invalid request.'); return; }
    const entry = files.get(pathname);
    if (!entry) { response.writeHead(404).end('Not found.'); return; }
    try {
      const data = await readFile(new URL(entry[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': entry[1].startsWith('image/') ? entry[1] : `${entry[1]}; charset=utf-8` });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch { response.writeHead(404).end('The requested wizard file is unavailable.'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argument = process.argv[2] ?? '8787';
  if (!/^\d+$/.test(argument) || Number(argument) > 65535 || Number(argument) < 1) {
    process.stderr.write('Usage: node v2/serve.mjs [port 1-65535]\n');
    process.exitCode = 1;
  } else {
    const server = createWizardServer();
    server.on('error', error => {
      process.stderr.write(`Wizard could not start: ${error.code || 'server error'}. Try another port.\n`);
      process.exitCode = 1;
    });
    server.listen(Number(argument), '127.0.0.1', () => {
      process.stdout.write(`Hermes setup wizard: http://127.0.0.1:${argument}\nKeep this terminal open. Press Ctrl+C to stop.\n`);
    });
  }
}
