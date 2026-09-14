// Portable interview engine. This records setup intent; it never installs or connects services.
const catalogUrl = new URL('./questions.json', import.meta.url);
const catalog = typeof process !== 'undefined' && process.versions?.node
  ? JSON.parse(await (await import('node:fs/promises')).readFile(catalogUrl, 'utf8'))
  : await (async () => {
    const response = await fetch(catalogUrl);
    if (!response.ok) throw new Error('The local question catalog could not be loaded.');
    return response.json();
  })();

export const MAX_SESSION_BYTES = 512 * 1024;
export const MAX_ANSWER_LENGTH = 12000;
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function fail(message) { throw new Error(message); }
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export const questions = freeze(catalog);
const byId = new Map(questions.map(question => [question.id, question]));
if (byId.size !== questions.length) fail('The question catalog has duplicate IDs.');
function validateCondition(condition, index) {
  if (!plain(condition)) fail('The question catalog contains an invalid branch.');
  if (own(condition, 'anyOf')) {
    if (Object.keys(condition).length !== 1 || !Array.isArray(condition.anyOf) || !condition.anyOf.length) fail('A question branch needs at least one condition.');
    condition.anyOf.forEach(item => validateCondition(item, index));
    return;
  }
  if (Object.keys(condition).length !== 2 || !own(condition, 'id') || !own(condition, 'includes') ||
      typeof condition.id !== 'string' || typeof condition.includes !== 'string') fail('The question catalog contains an invalid branch.');
  const parent = byId.get(condition.id);
  if (!parent || questions.indexOf(parent) >= index || !parent.options?.includes(condition.includes)) fail('A question branch must reference an earlier question and a listed option.');
}
for (const [index, q] of questions.entries()) {
  if (!/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/.test(q.id) ||
      !['text', 'textarea', 'single', 'multi'].includes(q.type)) fail('The question catalog contains an invalid definition.');
  if (q.when) validateCondition(q.when, index);
}

function checkPlain(value, name) {
  if (!plain(value)) fail(`${name} must be a plain JSON object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || forbiddenKeys.has(key)) fail(`${name} contains a forbidden key.`);
    if (!own(Object.getOwnPropertyDescriptor(value, key), 'value')) fail(`${name} cannot contain accessors.`);
  }
}
function timestamp(value, field) {
  if (typeof value !== 'string' || value.length > 32) fail(`${field} must be an ISO timestamp.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) fail(`${field} must be an ISO timestamp.`);
  return value;
}
function questionFor(id) {
  if (typeof id !== 'string' || !byId.has(id)) fail('Unknown question ID.');
  return byId.get(id);
}
function validateAnswer(question, value) {
  const label = question.title;
  if (question.type === 'multi') {
    if (!Array.isArray(value) || value.length === 0 || value.length > question.options.length) fail(`Choose one or more listed options for: ${label}`);
    if (new Set(value).size !== value.length || value.some(item => typeof item !== 'string' || !question.options.includes(item))) fail(`Only distinct listed options are accepted for: ${label}`);
    if (value.length > 1 && value.some(item => ['Not decided','Not sure yet','Decide later'].includes(item))) fail('Choose either an undecided option or concrete choices, not both.');
    return [...value];
  }
  if (typeof value !== 'string') fail(`An answer must be text for: ${label}`);
  if (!value.trim()) fail(`Enter an answer or skip this question: ${label}`);
  if (value.length > MAX_ANSWER_LENGTH) fail(`The answer is too long; use at most ${MAX_ANSWER_LENGTH} characters.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('Answers cannot contain control characters.');
  if (question.type === 'single' && !question.options.includes(value)) fail(`Choose a listed option for: ${label}`);
  if (question.id.endsWith('.credentialNames') && !value.split(/[\s,]+/).filter(Boolean).every(name => /^[A-Z_][A-Z0-9_]*$/.test(name))) {
    fail('Enter environment variable names only, separated by spaces or commas. Never enter credential values.');
  }
  return value;
}

export function createSession(mode = 'essential') {
  if (!['essential', 'deep'].includes(mode)) fail('Mode must be essential or deep.');
  const now = new Date().toISOString();
  return { version: 2, mode, answers: {}, skipped: [], createdAt: now, updatedAt: now };
}

export function validateSession(input) {
  let value = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > MAX_SESSION_BYTES) fail('The interview file is too large (maximum 512 KiB).');
    try { value = JSON.parse(input); } catch { fail('The interview file is not valid JSON.'); }
  }
  checkPlain(value, 'Session');
  const allowed = ['version', 'mode', 'answers', 'skipped', 'createdAt', 'updatedAt'];
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('The interview contains an unknown session field.');
  if (allowed.some(key => !own(value, key))) fail('The interview is missing a required session field.');
  if (value.version !== 2) fail('Unsupported interview version. This wizard accepts version 2 only.');
  if (!['essential', 'deep'].includes(value.mode)) fail('Mode must be essential or deep.');
  checkPlain(value.answers, 'Answers');
  if (Object.keys(value.answers).length > questions.length) fail('The interview contains too many answers.');
  const answers = {};
  for (const id of Object.keys(value.answers)) answers[id] = validateAnswer(questionFor(id), value.answers[id]);
  if (!Array.isArray(value.skipped) || value.skipped.length > questions.length) fail('Skipped questions must be a list of known question IDs.');
  if (new Set(value.skipped).size !== value.skipped.length) fail('Skipped question IDs must be unique.');
  for (const id of value.skipped) {
    const question = questionFor(id);
    if (question.required) fail('Required questions cannot be marked skipped.');
    if (own(answers, id)) fail('A question cannot be both answered and skipped.');
  }
  const createdAt = timestamp(value.createdAt, 'createdAt');
  const updatedAt = timestamp(value.updatedAt, 'updatedAt');
  if (updatedAt < createdAt) fail('The update time cannot precede the creation time.');
  const normalized = { version: 2, mode: value.mode, answers, skipped: [...value.skipped], createdAt, updatedAt };
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > MAX_SESSION_BYTES) fail('The interview file is too large (maximum 512 KiB).');
  return normalized;
}

function activeQuestions(session) {
  const activeIds = new Set();
  const result = [];
  const matches = condition => {
    if (condition.anyOf) return condition.anyOf.some(matches);
    if (!activeIds.has(condition.id)) return false;
    const parent = session.answers[condition.id];
    return Array.isArray(parent) ? parent.includes(condition.includes) : parent === condition.includes;
  };
  for (const question of questions) {
    if (session.mode === 'essential' && question.depth === 'deep') continue;
    if (question.when && !matches(question.when)) continue;
    activeIds.add(question.id);
    result.push(question);
  }
  return result;
}
export function getQuestions(session) { return activeQuestions(validateSession(session)); }
export function getNextQuestion(session) {
  const valid = validateSession(session);
  return activeQuestions(valid).find(question => !own(valid.answers, question.id) && !valid.skipped.includes(question.id)) || null;
}
function editable(session, id) {
  const valid = validateSession(session);
  const question = questionFor(id);
  if (!activeQuestions(valid).some(q => q.id === id)) fail('This question is not active. Select its topic or switch to deep mode first.');
  return { valid, question };
}
export function answerQuestion(session, id, value) {
  const { valid, question } = editable(session, id);
  return validateSession({ ...valid, answers: { ...valid.answers, [id]: validateAnswer(question, value) },
    skipped: valid.skipped.filter(item => item !== id), updatedAt: new Date(Math.max(Date.now(), Date.parse(valid.updatedAt))).toISOString() });
}
export function skipQuestion(session, id) {
  const { valid, question } = editable(session, id);
  if (question.required) fail('This question needs an answer before continuing.');
  const answers = { ...valid.answers };
  delete answers[id];
  return validateSession({ ...valid, answers, skipped: [...new Set([...valid.skipped, id])],
    updatedAt: new Date(Math.max(Date.now(), Date.parse(valid.updatedAt))).toISOString() });
}

const verificationChecklist = freeze([
  { id: 'target', title: 'Confirm the target installation', details: 'Verify the named machine, installation state, exact Hermes version and official configuration schema before any changes.' },
  { id: 'backup', title: 'Preserve a recovery path', details: 'Back up existing configuration and profile state, identify the recovery owner and prove that recovery is possible.' },
  { id: 'models', title: 'Verify models and selected routing', details: 'Confirm provider IDs, model availability, authentication and endpoint compatibility. Configure only user-selected models and fallbacks; test a real response for each intended route.' },
  { id: 'memory', title: 'Verify memory and knowledge separately', details: 'Distinguish built-in memory, an external memory provider, embeddings and knowledge-source skills. Confirm supported settings, access boundaries, write/read behavior and source retrieval.' },
  { id: 'secrets', title: 'Provision secrets outside this interview', details: 'Use an approved secure mechanism. This handoff contains variable names only and must not be populated with credential values.' },
  { id: 'connections', title: 'Verify channels, skills and profiles', details: 'Check each integration against the installed schema, confirm intended identities and allowed scope, then test a non-destructive roundtrip. A selected tool is not an access grant.' },
  { id: 'approvals', title: 'Test permission and context boundaries', details: 'Resolve action-specific approval, recipients and context isolation before enabling external actions. Interview prose is not enforcement.' },
  { id: 'routines', title: 'Review recurring tasks before enabling', details: 'Resolve cadence, timezone, destination, failure behavior and retirement. Create tasks paused where supported; verify delivery before enabling anything.' },
  { id: 'receipt', title: 'Record verified outcomes and remaining gaps', details: 'Separate requested, configured and tested states. Keep concrete evidence of each check and leave failures or unknowns unresolved.' },
]);
export function buildSetupPlan(session) {
  const valid = validateSession(session);
  const active = activeQuestions(valid);
  const deferredChoices = new Set(['Not decided','Not sure yet','Decide later','Decide after trying the basics']);
  const deferred = q => {
    const value = valid.answers[q.id];
    return q.type === 'single' ? deferredChoices.has(value) : q.type === 'multi' && Array.isArray(value) && value.some(item => deferredChoices.has(item));
  };
  return {
    kind: 'hermes-setup-intent', version: 1, sessionVersion: 2, mode: valid.mode,
    status: 'Intent only; not installed or verified',
    configuredIntents: active.filter(q => own(valid.answers, q.id)).map(q => ({ id: q.id, chapter: q.chapter, title: q.title, value: valid.answers[q.id] })),
    unresolvedRequirements: active.filter(q => !own(valid.answers, q.id) || deferred(q)).map(q => ({ id: q.id, title: q.title,
      reason: deferred(q) ? 'User left this decision open; unresolved' : valid.skipped.includes(q.id) ? 'Skipped; unresolved' : 'Not answered; unresolved' })),
    checklist: verificationChecklist.map(item => ({ ...item, status: 'not-verified' })),
  };
}
export function buildProfile(session) {
  const plan = buildSetupPlan(session);
  const lines = ['# Hermes setup handoff', '', '**Status: intent only. Nothing has been installed, connected or verified by this wizard.**', '',
    'This is a portable record of explicit user answers, not a Hermes configuration file. Verify the target version and official schema before translating any intent into settings. Selected interests, tools and services do not grant permission to act.', '',
    `Interview mode: ${plan.mode}`, '', '## Recorded decisions', ''];
  let chapter = '';
  for (const item of plan.configuredIntents) {
    if (chapter !== item.chapter) { lines.push(`### ${item.chapter}`, ''); chapter = item.chapter; }
    const literalAnswer = (Array.isArray(item.value) ? item.value.join('\n') : item.value)
      .split(/\r\n|\r|\n/).map(line => '> ' + line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&')).join('\n');
    lines.push(`**${item.title}**`, '', literalAnswer, '');
  }
  if (!plan.configuredIntents.length) lines.push('No decisions recorded.', '');
  lines.push('## Unresolved decisions', '');
  if (!plan.unresolvedRequirements.length) lines.push('All active interview questions have a recorded answer. Setup verification is still outstanding.', '');
  for (const item of plan.unresolvedRequirements) lines.push(`- ${item.title} — ${item.reason}`);
  lines.push('', '## Setup verification checklist', '');
  for (const item of plan.checklist) lines.push(`- [ ] **${item.title}** — ${item.details}`);
  lines.push('', 'Keep this handoff private: it contains your answers. A deployment agent must resolve missing details and obtain any necessary action-specific authorization before changing the target system.', '');
  return lines.join('\n');
}
