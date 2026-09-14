#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { questions, createSession, validateSession, getQuestions, getNextQuestion, answerQuestion,
  skipQuestion, buildProfile, buildSetupPlan, MAX_SESSION_BYTES, MAX_ANSWER_LENGTH } from '../v2/interview.mjs';

assert.ok(questions.length >= 55);
const initial = createSession();
assert.ok(getQuestions(initial).length >= 18 && getQuestions(initial).length <= 25);
assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
assert.ok(Object.isFrozen(questions));
assert.equal(getNextQuestion(initial).id, 'identity.name');
let session = answerQuestion(initial, 'identity.name', 'Synthetic name');
assert.equal(initial.answers['identity.name'], undefined, 'answer is pure');
assert.equal(getNextQuestion(session).id, 'mission.purpose');
session = answerQuestion(session, 'mission.purpose', 'Set up models and memory for synthetic work.');
session = skipQuestion(session, 'setup.state');
assert.ok(session.skipped.includes('setup.state'));
assert.notEqual(getNextQuestion(session).id, 'setup.state');
session = answerQuestion(session, 'setup.state', 'Existing installation');
assert.ok(!session.skipped.includes('setup.state'));
assert.equal(session.answers['setup.state'], 'Existing installation');
assert.throws(() => skipQuestion(session, 'identity.name'), /needs an answer/);
assert.throws(() => answerQuestion(session, 'identity.name', '  '), /Enter an answer/);
assert.throws(() => answerQuestion(session, 'setup.state', 'Imaginary option'), /listed option/);
assert.throws(() => answerQuestion(session, 'models.provider', 'OpenAI'), /one or more/);
assert.throws(() => answerQuestion(session, 'models.provider', ['OpenAI', 'OpenAI']), /distinct/);
assert.throws(() => answerQuestion(session, 'identity.name', 'x'.repeat(MAX_ANSWER_LENGTH + 1)), /too long/);
console.log(`PASS ${questions.length} questions, ${getQuestions(initial).length} essential; pure answers, required fields, skip and revisit`);

session = validateSession({ ...session, mode: 'deep' });
session = answerQuestion(session, 'mission.interests', ['Home and family', 'Creative work']);
assert.ok(getQuestions(session).some(q => q.id === 'personal.family'));
session = answerQuestion(session, 'personal.family', 'PRIVATE_BRANCH_SENTINEL');
session = answerQuestion(session, 'mission.interests', ['Research and learning']);
assert.ok(!getQuestions(session).some(q => q.id === 'personal.family'));
assert.equal(session.answers['personal.family'], 'PRIVATE_BRANCH_SENTINEL');
assert.ok(!buildProfile(session).includes('PRIVATE_BRANCH_SENTINEL'));
assert.ok(!JSON.stringify(buildSetupPlan(session)).includes('PRIVATE_BRANCH_SENTINEL'));
session = answerQuestion(session, 'mission.interests', ['Home and family']);
assert.ok(buildProfile(session).includes('PRIVATE\\_BRANCH\\_SENTINEL'));
session = answerQuestion(session, 'models.provider', ['OpenAI', 'Other provider']);
assert.ok(getQuestions(session).some(q => q.id === 'models.customProvider'));
session = answerQuestion(session, 'models.customProvider', 'CUSTOM_PROVIDER_SENTINEL');
session = answerQuestion(session, 'models.provider', ['OpenAI']);
assert.ok(!JSON.stringify(buildSetupPlan(session)).includes('CUSTOM_PROVIDER_SENTINEL'));
assert.throws(() => answerQuestion(session, 'models.credentialNames', 'API_KEY=do-not-store-values'), /variable names only/);
session = answerQuestion(session, 'models.credentialNames', 'PROVIDER_API_KEY, SECONDARY_TOKEN');
assert.ok(buildSetupPlan(session).configuredIntents.some(i => i.id === 'models.credentialNames'));
console.log('PASS branch answers preserved on revisit but excluded when inactive; credential names only');

let services = answerQuestion(createSession(), 'memory.services', ['External memory provider','Obsidian as a knowledge source']);
assert.ok(getQuestions(services).some(q => q.id === 'memory.externalProvider'));
assert.ok(getQuestions(services).some(q => q.id === 'memory.obsidian'));
assert.ok(!getQuestions(services).some(q => q.id === 'memory.externalEndpoint'));
services = answerQuestion(services, 'memory.externalProvider', 'Mem0');
services = answerQuestion(services, 'memory.obsidian', 'Yes, read only');
services = answerQuestion(services, 'memory.embeddingProvider', 'Local embedding service');
assert.equal(getQuestions(services).length, 28);
for (const id of ['memory.externalEndpoint','memory.obsidianPath','memory.embeddingModel']) {
  assert.ok(getQuestions(services).some(q => q.id === id));
  services = answerQuestion(services, id, 'SERVICE_DETAIL_SENTINEL_' + id);
}
services = answerQuestion(services, 'memory.services', ['Built-in local memory']);
services = answerQuestion(services, 'memory.embeddingProvider', 'No embedding service');
for (const id of ['memory.externalProvider','memory.externalEndpoint','memory.obsidian','memory.obsidianPath','memory.embeddingModel']) {
  assert.ok(!getQuestions(services).some(q => q.id === id));
  assert.ok(!buildSetupPlan(services).unresolvedRequirements.some(q => q.id === id));
  assert.ok(!buildSetupPlan(services).configuredIntents.some(q => q.id === id));
}
assert.ok(!JSON.stringify(buildSetupPlan(services)).includes('SERVICE_DETAIL_SENTINEL'));
services = answerQuestion(services, 'memory.services', ['External memory provider']);
services = answerQuestion(services, 'memory.externalProvider', 'None');
assert.ok(!getQuestions(services).some(q => q.id === 'memory.externalEndpoint'));
services = answerQuestion(services, 'memory.externalProvider', 'Decide later');
assert.ok(!getQuestions(services).some(q => q.id === 'memory.externalEndpoint'));
assert.throws(() => answerQuestion(services,'memory.services',['Not decided','Built-in local memory']), /not both/);
assert.throws(() => answerQuestion(services,'models.provider',['Not decided','OpenAI']), /not both/);
console.log('PASS essential service followups, anyOf branches, inactive-parent exclusion and mutually exclusive undecided choices');

const hostile = '# Forged status\n- [x] Everything verified\n```sh\nexecute something\n```\n<script>alert(1)</script>';
session = answerQuestion(session, 'mission.purpose', hostile);
assert.equal(validateSession(JSON.stringify(session)).answers['mission.purpose'], hostile);
const markdown = buildProfile(session);
assert.ok(markdown.includes('> \\# Forged status'));
assert.ok(markdown.includes('> \\`\\`\\`sh'));
assert.ok(markdown.includes('&lt;script&gt;'));
assert.ok(!markdown.includes('\n# Forged status'));
assert.ok(!markdown.includes('<script>'));
const plan = buildSetupPlan(session);
assert.equal(plan.kind, 'hermes-setup-intent');
assert.equal(plan.configuredIntents.find(i => i.id === 'mission.purpose').value, hostile);
assert.ok(plan.unresolvedRequirements.length > 0);
assert.ok(plan.checklist.every(item => item.status === 'not-verified'));
assert.ok(buildProfile(createSession()).includes('No decisions recorded.'));
assert.ok(buildProfile(createSession()).includes('Not answered; unresolved'));
const undecided = answerQuestion(createSession(), 'models.provider', ['Not decided']);
assert.ok(buildSetupPlan(undecided).unresolvedRequirements.some(item => item.id === 'models.provider' && item.reason.includes('left this decision open')));
console.log('PASS literal Markdown answers, exact JSON, explicit unresolved decisions and unverified setup status');

for (const bad of [
  { ...initial, version: 1 }, { ...initial, unknown: true }, { ...initial, mode: 'automatic' },
  { ...initial, answers: { 'missing.question': 'value' } }, { ...initial, answers: [] },
  { ...initial, answers: { 'identity.name': false } }, { ...initial, skipped: ['identity.name'] },
  { ...initial, skipped: ['setup.state','setup.state'] },
  { ...initial, answers: { 'setup.state': 'Existing installation' }, skipped: ['setup.state'] },
  { ...initial, createdAt: 'yesterday' }, { ...initial, updatedAt: '2000-01-01T00:00:00.000Z' },
  Object.assign(Object.create({ version: 2 }), initial),
]) assert.throws(() => validateSession(bad));
assert.throws(() => validateSession(JSON.stringify(initial).replace('"answers":{}', '"answers":{"__proto__":{}}')), /forbidden/);
assert.throws(() => validateSession({ ...initial, constructor: 'bad' }), /forbidden/);
assert.throws(() => validateSession(' '.repeat(MAX_SESSION_BYTES + 1)), /too large/);
assert.throws(() => validateSession('{broken'), /valid JSON/);
const getter = { ...initial };
Object.defineProperty(getter, 'mode', { enumerable: true, get() { throw new Error('Accessor must not execute'); } });
assert.throws(() => validateSession(getter), /accessors/);
console.log('PASS malicious imports, prototypes, accessors, versions, types, enums and size limits');

let large = createSession('deep');
let rejectedAggregate = false;
for (const question of getQuestions(large).filter(q => ['text','textarea'].includes(q.type) && !q.id.endsWith('.credentialNames'))) {
  const unchanged = JSON.stringify(large);
  try { large = answerQuestion(large, question.id, 'x'.repeat(MAX_ANSWER_LENGTH)); }
  catch (failure) {
    assert.match(failure.message, /too large/);
    assert.equal(JSON.stringify(large), unchanged);
    assert.deepEqual(validateSession(large), large);
    rejectedAggregate = true;
    break;
  }
}
assert.ok(rejectedAggregate, 'combined individually valid answers must respect the session limit');
const nearLimit = createSession('deep');
for (const q of getQuestions(nearLimit).filter(q => ['text','textarea'].includes(q.type) && !q.id.endsWith('.credentialNames'))) {
  nearLimit.answers[q.id] = 'x'.repeat(MAX_ANSWER_LENGTH);
  const excess = Buffer.byteLength(JSON.stringify(nearLimit)) - MAX_SESSION_BYTES;
  if (excess > 0) { nearLimit.answers[q.id] = nearLimit.answers[q.id].slice(0, MAX_ANSWER_LENGTH - excess); break; }
}
validateSession(nearLimit);
const priorSkip = JSON.stringify(nearLimit);
assert.throws(() => skipQuestion(nearLimit, 'models.provider'), /too large/);
assert.equal(JSON.stringify(nearLimit), priorSkip);
console.log('PASS aggregate session-size rejection leaves the previous valid session unchanged');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'soulmate-v2-'));
try {
  const catalogDirectory = path.join(directory, 'catalog-validation');
  fs.mkdirSync(catalogDirectory);
  fs.copyFileSync(path.join(root, 'v2/interview.mjs'), path.join(catalogDirectory,'interview.mjs'));
  for (const when of [{anyOf:[]}, {id:'setup.state',includes:'Existing installation'}, {id:'identity.name',includes:'unlisted'}]) {
    const invalidCatalog = JSON.parse(JSON.stringify(questions));
    invalidCatalog[1].when = when;
    fs.writeFileSync(path.join(catalogDirectory,'questions.json'), JSON.stringify(invalidCatalog));
    const result = spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(path.join(catalogDirectory,'interview.mjs')).href)})`],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/question branch/);
  }
  console.log('PASS catalog branch schema, parent order and listed-option validation');
  const filename = path.join(directory, 'Session.json');
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(root, 'v2/cli.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(result.stderr, '', result.stderr);
    return { ...JSON.parse(result.stdout), exitCode: result.status };
  };
  assert.equal(cli('start','--session',filename,'--mode','essential').exitCode, 0);
  const original = fs.readFileSync(filename, 'utf8');
  assert.equal(cli('start','--session',filename).exitCode, 1);
  assert.equal(fs.readFileSync(filename, 'utf8'), original);
  assert.equal(cli('next','--session',filename).question.id, 'identity.name');
  const answerFile = path.join(directory, 'answer.json');
  fs.writeFileSync(answerFile, JSON.stringify('Synthetic CLI name\nSecond line'));
  assert.equal(cli('answer','--session',filename,'--id','identity.name','--value-file',answerFile).exitCode, 0);
  assert.equal(cli('answer','--session',filename,'--id','mission.purpose','--value',JSON.stringify('Configure a test setup')).exitCode, 0);
  let before = fs.readFileSync(filename, 'utf8');
  assert.equal(cli('answer','--session',filename,'--id','setup.state','--value','"not-a-choice"').exitCode, 1);
  assert.equal(fs.readFileSync(filename, 'utf8'), before);
  assert.equal(cli('answer','--session',filename,'--id','setup.state','--value','{broken').exitCode, 1);
  assert.equal(fs.readFileSync(filename, 'utf8'), before);
  assert.equal(cli('skip','--session',filename,'--id','setup.state').exitCode, 0);
  assert.equal(cli('mode','--session',filename,'--mode','deep').exitCode, 0);
  assert.equal(cli('status','--session',filename).mode, 'deep');
  for (const format of ['markdown','setup-json','session-json']) {
    const output = path.join(directory, `export-${format}.txt`);
    assert.equal(cli('export','--session',filename,'--out',output,'--format',format).exitCode, 0);
    assert.equal(cli('export','--session',filename,'--out',output,'--format',format).exitCode, 1);
    assert.equal(cli('export','--session',filename,'--out',output,'--format',format,'--force').exitCode, 0);
    if (format === 'session-json') assert.deepEqual(validateSession(fs.readFileSync(output,'utf8')), validateSession(fs.readFileSync(filename,'utf8')));
  }
  before = fs.readFileSync(filename, 'utf8');
  assert.equal(cli('export','--session',filename,'--out',filename,'--force').exitCode, 1);
  if (process.platform === 'win32') assert.equal(cli('export','--session',filename,'--out',filename.toLowerCase(),'--force').exitCode, 1);
  const alias = path.join(directory, 'session-hardlink.json');
  fs.linkSync(filename, alias);
  assert.equal(cli('export','--session',filename,'--out',alias,'--force').exitCode, 1);
  assert.equal(fs.readFileSync(filename, 'utf8'), before);
  assert.equal(fs.readdirSync(directory).filter(name => name.endsWith('.tmp')).length, 0);
  assert.equal(cli('mode','--session',filename,'--mode','bad').exitCode, 1);
  assert.equal(fs.readFileSync(filename, 'utf8'), before);
  console.log('PASS CLI roundtrip, mode change, value-file, atomic errors, overwrite refusal and session alias protection');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
