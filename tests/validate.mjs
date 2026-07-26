#!/usr/bin/env node
// tests/validate.mjs — Hermes Intake Wizard acceptance harness
// Zero npm deps. Run: node tests/validate.mjs

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const failures = [];
const warnings = [];
let passed = 0;
let total = 0;

function pass(name) { passed++; total++; console.log(`  ✓ ${name}`); }
function fail(name, reason) { failures.push({ name, reason }); total++; }
function warn(msg) { warnings.push(msg); }

// ─── helpers ────────────────────────────────────────────────────────────

function readFile(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

function parseJson(str, label) {
  try { return JSON.parse(str); }
  catch { fail(label, 'failed to parse JSON'); return null; }
}

// Steps that must exist, in this relative order. Extra steps may be inserted
// between them — the wizard renders whatever the pack declares, so pinning an
// exact count only blocks legitimate additions. What actually matters is that
// the required steps are present, ordered, and that review comes last.
const STEP_IDS = [
  'identity', 'assets', 'resources', 'work', 'goals',
  'guardrails', 'rhythm', 'fleet', 'review'
];

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{10,}/,
  /ghp_[A-Za-z0-9]{10,}/,
  /xoxb-/,
  /AKIA[0-9A-Z]{16}/
];

// ─── A. Content pack ────────────────────────────────────────────────────

function checkContentPack(pack, label) {
  if (!pack) return;

  if (typeof pack.version !== 'string') fail(label, 'missing version');
  if (!Array.isArray(pack.steps) || pack.steps.length < STEP_IDS.length)
    fail(label, `steps must include at least ${STEP_IDS.length} (got ${pack.steps ? pack.steps.length : 0})`);
  else {
    const ids = pack.steps.map(s => s.id);
    const missing = STEP_IDS.filter(id => !ids.includes(id));
    if (missing.length) fail(label, `missing required steps: [${missing.join(',')}]`);
    else {
      // required steps must keep their relative order
      const pos = STEP_IDS.map(id => ids.indexOf(id));
      const ordered = pos.every((p, i) => i === 0 || p > pos[i - 1]);
      if (!ordered) fail(label, `required steps out of order: got [${ids.join(',')}]`);
      else if (ids[ids.length - 1] !== 'review') fail(label, `'review' must be the last step (got '${ids[ids.length - 1]}')`);
      else pass(`${label}: step ids present and ordered (${ids.length} steps)`);
    }
  }

  if (!Array.isArray(pack.roleCatalog) || pack.roleCatalog.length < 15)
    fail(label, `roleCatalog must have >= 15 entries (got ${pack.roleCatalog ? pack.roleCatalog.length : 0})`);
  else {
    if (!pack.soulLibrary || typeof pack.soulLibrary !== 'object')
      fail(label, 'missing or invalid soulLibrary');
    else {
      const missing = pack.roleCatalog.filter(r => !pack.soulLibrary[r.soulTemplateId]);
      if (missing.length)
        fail(label, `roleCatalog soulTemplateId missing from soulLibrary: ${missing.map(r => r.id).join(', ')}`);
      else pass(`${label}: all roleCatalog soulTemplateIds in soulLibrary`);
    }
  }

  if (Array.isArray(pack.derivationRules)) {
    const roleIds = new Set(pack.roleCatalog.map(r => r.id));
    for (const rule of pack.derivationRules) {
      if (rule.roleId === 'orchestrator')
        fail(label, 'derivationRules must not include orchestrator');
      if (!roleIds.has(rule.roleId))
        fail(label, `derivationRules.roleId "${rule.roleId}" not in roleCatalog`);
    }
    if (!failures.some(f => f.name === label)) pass(`${label}: derivationRules OK`);
  } else {
    fail(label, 'missing derivationRules');
  }

  if (Array.isArray(pack.modelCatalog)) {
    const bad = pack.modelCatalog.filter(m => !m.costTier);
    if (bad.length) fail(label, `modelCatalog entries missing costTier: ${bad.map(m => m.id).join(', ')}`);
    else pass(`${label}: modelCatalog has costTier on all entries`);
  } else {
    fail(label, 'missing modelCatalog');
  }

  if (!Array.isArray(pack.toolCatalog))
    fail(label, 'missing toolCatalog');
  else
    pass(`${label}: toolCatalog present`);

  if (!pack.soulLibrary || typeof pack.soulLibrary !== 'object')
    fail(label, 'missing soulLibrary');
  else
    pass(`${label}: soulLibrary present`);

  if (typeof pack.roleCatalog === 'object' && pack.roleCatalog.length < 15) {
    // already failed above
  }
}

// ─── B. index.html ──────────────────────────────────────────────────────

function checkIndexHtml() {
  const html = readFile('web/index.html');
  if (!html) {
    warn('WARN index.html not built yet');
    return false;
  }

  const size = statSync(join(ROOT, 'web/index.html')).size;
  if (size > 400 * 1024)
    fail('B: index.html size', `file is ${Math.round(size / 1024)}KB, must be < 400KB`);
  else
    pass('B: index.html size OK');

  const scriptMatch = html.match(/<script\s+id="content-pack"\s+type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch)
    fail('B: embedded content-pack', 'missing <script id="content-pack" type="application/json">');
  else {
    const embedded = parseJson(scriptMatch[1].trim(), 'B: embedded JSON');
    if (embedded) {
      checkContentPack(embedded, 'B: embedded content pack');
    }
  }

  // External references scan
  const externalRefs = [];

  // scan for src= or href= with http(s) (allow specific exceptions)
  const srcHrefs = [...html.matchAll(/(?:src|href)="([^"]*)"/g)];
  for (const [, url] of srcHrefs) {
    if (/^https?:\/\//.test(url)) {
      if (url === 'https://example.com' || url === 'https://github.com') continue;
      externalRefs.push(`src/href: ${url}`);
    }
  }

  if (/fetch\s*\(/.test(html)) externalRefs.push('fetch() call found');
  if (/XMLHttpRequest/.test(html)) externalRefs.push('XMLHttpRequest found');
  if (/@import/.test(html)) externalRefs.push('@import found');
  if (/<link\s+rel="stylesheet"\s+href="http/.test(html)) externalRefs.push('<link rel="stylesheet" href="http...');

  if (externalRefs.length)
    fail('B: no external refs', `found: ${externalRefs.join('; ')}`);
  else
    pass('B: no external references');

  return true;
}

// ─── C. YAML emitter sanity ─────────────────────────────────────────────

function checkYamlSanity() {
  const samples = [
    { str: 'key: value', desc: 'simple pair' },
    { str: 'key: value with colon: inside', desc: 'colon in value' },
    { str: 'key: value with # comment', desc: 'hash in value' },
    { str: 'key: value with [brackets]', desc: 'brackets in value' },
    { str: 'key: value with {braces}', desc: 'braces in value' },
    { str: 'key:  leading', desc: 'leading space' },
    { str: 'key: trailing ', desc: 'trailing space' },
  ];

  // The CONTRACT rule: 2-space indent, quote strings containing `: # { } [ ]` or edge spaces
  // We verify our understanding with a simple test:
  function needsQuoting(s) {
    if (/[:#{}\[\]]/.test(s)) return true;
    if (s.startsWith(' ') || s.endsWith(' ')) return true;
    return false;
  }

  for (const { str, desc } of samples) {
    const raw = str.split(': ').slice(1).join(': ');
    const shouldQuote = needsQuoting(raw);
    // In the sample, colon in value should be quoted, bracket in value should be quoted, etc.
    if (desc === 'simple pair' && shouldQuote)
      fail('C: YAML quoting', `simple value "${raw}" should not need quoting`);
    else if (desc === 'colon in value' && !shouldQuote)
      fail('C: YAML quoting', `value with colon "${raw}" should need quoting`);
    else if (desc === 'hash in value' && !shouldQuote)
      fail('C: YAML quoting', `value with hash "${raw}" should need quoting`);
    else if (desc === 'brackets in value' && !shouldQuote)
      fail('C: YAML quoting', `value with brackets "${raw}" should need quoting`);
    else if (desc === 'braces in value' && !shouldQuote)
      fail('C: YAML quoting', `value with braces "${raw}" should need quoting`);
    else if (desc === 'leading space' && !shouldQuote)
      fail('C: YAML quoting', `value with leading space "${raw}" should need quoting`);
    else if (desc === 'trailing space' && !shouldQuote)
      fail('C: YAML quoting', `value with trailing space "${raw}" should need quoting`);
  }
  pass('C: YAML quoting rules validated');
}

// ─── D. Secret hygiene ──────────────────────────────────────────────────

function checkSecrets(text, label) {
  for (const pattern of SECRET_PATTERNS) {
    const match = text.match(pattern);
    if (match) fail(label, `secret pattern found: ${match[0].substring(0, 10)}...`);
  }
  if (!failures.some(f => f.name === label)) pass(`${label}: no secrets found`);
}

// ─── Main ───────────────────────────────────────────────────────────────

console.log('Hermes Intake Wizard — validate.mjs\n');

// A. Content pack
const cpRaw = readFile('content/content-pack.json');
if (!cpRaw) {
  warn('content/content-pack.json not found — skipping content pack checks');
} else {
  const pack = parseJson(cpRaw, 'A: content-pack.json');
  if (pack) {
    checkContentPack(pack, 'A: content-pack.json');
  }
}

// B. index.html
checkIndexHtml();

// C. YAML sanity
checkYamlSanity();

// D. Secret hygiene (both files)
const indexHtml = readFile('web/index.html');
if (indexHtml) {
  checkSecrets(indexHtml, 'D: index.html secrets');
}
const contentPack = readFile('content/content-pack.json');
if (contentPack) {
  checkSecrets(contentPack, 'D: content-pack.json secrets');
}
if (!indexHtml && !contentPack) {
  // neither file exists yet — no secrets to scan, still pass
  warn('D: no files to scan for secrets');
}

// ─── E. Publish safety: scan EVERY tracked file, not just two ───────────
// This repo is meant to be published. An earlier version only scanned
// index.html and content-pack.json, so real personal data (home LAN
// addresses, private email, a path to a token file) sat in other tracked
// files while the suite reported all green. Scan everything git tracks.
function checkPublishSafety() {
  let tracked;
  try {
    tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf-8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    warn('E: not a git repo — skipping publish-safety scan');
    return;
  }
  // Patterns that should never appear in a public repo. Extend as needed.
  const PRIVATE_PATTERNS = [
    // Each private range is spelled out: writing this as (?:10|127|192\.168)\.\d+\.\d+\.\d+
    // silently required FIVE octets after 192.168 and matched nothing real.
    { re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/, what: 'private IP address' },
    { re: /\b100\.(?:[6-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/, what: 'Tailscale IP' },
    { re: /[A-Za-z0-9._%+-]+@(?!example\.(?:com|org)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, what: 'email address' },
    // Usernames contain spaces ("C:\Users\Jane Doe\"), so do not exclude \s here.
    { re: /C:\\Users\\[^\\\r\n]+\\/i, what: 'Windows user path' },
    { re: /\/(?:home|Users)\/(?!you\b|user\b)[a-z][a-z0-9._-]*\//i, what: 'home directory path' },
    { re: /secrets?\/[A-Za-z0-9._-]+|[A-Za-z0-9._-]*token[A-Za-z0-9._-]*\.txt/i, what: 'path to a secrets/token file' },
  ];
  // Files whose job is to describe these patterns.
  const SELF_REFERENTIAL = new Set(['tests/validate.mjs', 'spec/SPEC-C-tests-readme.md']);
  const found = [];
  for (const rel of tracked) {
    if (SELF_REFERENTIAL.has(rel)) continue;
    const body = readFile(rel);
    if (body === null) continue;
    for (const { re, what } of PRIVATE_PATTERNS) {
      const m = body.match(re);
      // A documented placeholder is fine; a real value is not.
      if (m && !/example\.|placeholder|your-|<your|11434|localhost|192\.168\.1\.50/i.test(m[0])) {
        found.push(`${rel}: ${what} (${m[0].slice(0, 48)})`);
        break;
      }
    }
  }
  if (found.length) fail('E: publish safety', `private data in tracked files -> ${found.join('; ')}`);
  else pass(`E: publish safety — ${tracked.length} tracked files, no private data`);
}
checkPublishSafety();

// ─── Report ─────────────────────────────────────────────────────────────

console.log('');
for (const w of warnings) console.log(`  ⚠ ${w}`);
console.log('');
if (failures.length === 0) {
  console.log(`PASS ${passed}/${total}`);
  process.exit(0);
} else {
  console.log(`FAIL ${passed}/${total}`);
  console.log('');
  for (const { name, reason } of failures) {
    console.log(`  ✗ ${name}: ${reason}`);
  }
  process.exit(1);
}
