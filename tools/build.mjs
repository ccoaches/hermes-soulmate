#!/usr/bin/env node
/**
 * build.mjs — embed content/content-pack.json into web/index.html.
 *
 * The app is a single self-contained HTML file: the content pack is inlined as
 * <script id="content-pack" type="application/json">. That copy is what actually
 * runs. content/content-pack.json is the SOURCE OF TRUTH; this script pushes it
 * into the page so the two can never drift (they did before this existed).
 *
 *   node tools/build.mjs          # embed pack -> index.html
 *   node tools/build.mjs --check  # verify they match; exit 1 if not (CI/pre-commit)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(root, 'content', 'content-pack.json');
const PAGE = path.join(root, 'web', 'index.html');
const OPEN = '<script id="content-pack" type="application/json">';
const CLOSE = '</script>';

const checkOnly = process.argv.includes('--check');

const packRaw = fs.readFileSync(PACK, 'utf8');
let pack;
try {
  pack = JSON.parse(packRaw);
} catch (e) {
  console.error('FAIL: content-pack.json is not valid JSON —', e.message);
  process.exit(1);
}

// Inlined JSON must never contain a literal </script> or a lone "<!--".
const serialized = JSON.stringify(pack, null, 2)
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');

const html = fs.readFileSync(PAGE, 'utf8');
const start = html.indexOf(OPEN);
if (start === -1) {
  console.error('FAIL: no <script id="content-pack"> block in web/index.html');
  process.exit(1);
}
const bodyStart = start + OPEN.length;
const end = html.indexOf(CLOSE, bodyStart);
if (end === -1) {
  console.error('FAIL: unterminated content-pack script block');
  process.exit(1);
}

const embedded = html.slice(bodyStart, end);
const matches = (() => {
  try {
    return JSON.stringify(JSON.parse(embedded)) === JSON.stringify(pack);
  } catch {
    return false;
  }
})();

if (checkOnly) {
  if (matches) {
    console.log('OK: embedded pack matches content/content-pack.json');
    process.exit(0);
  }
  console.error('DRIFT: web/index.html does not match content/content-pack.json — run `node tools/build.mjs`');
  process.exit(1);
}

if (matches) {
  console.log('OK: already in sync (no write needed)');
  process.exit(0);
}

fs.writeFileSync(PAGE, html.slice(0, bodyStart) + '\n' + serialized + '\n' + html.slice(end));
const counts = {
  models: pack.modelCatalog?.length ?? 0,
  tools: pack.toolCatalog?.length ?? 0,
  roles: pack.roleCatalog?.length ?? 0,
  souls: Object.keys(pack.soulLibrary ?? {}).length,
  steps: pack.steps?.length ?? 0,
};
console.log('EMBEDDED content-pack -> web/index.html');
console.log(`  models:${counts.models} tools:${counts.tools} roles:${counts.roles} souls:${counts.souls} steps:${counts.steps}`);
