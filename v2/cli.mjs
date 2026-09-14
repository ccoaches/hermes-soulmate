#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSession, validateSession, getQuestions, getNextQuestion, answerQuestion, skipQuestion,
  buildProfile, buildSetupPlan, MAX_SESSION_BYTES } from './interview.mjs';

const commands = {
  start: ['session','mode','force'], next: ['session'], answer: ['session','id','value','value-file'],
  skip: ['session','id'], status: ['session'], export: ['session','out','format','force'], mode: ['session','mode'],
};
function error(message) { throw new Error(message); }
function parse(args) {
  const [command, ...rest] = args;
  if (!Object.hasOwn(commands, command)) error('Command must be start, next, answer, skip, status, mode or export.');
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const name = rest[i].startsWith('--') ? rest[i].slice(2) : '';
    if (!commands[command].includes(name) || Object.hasOwn(options, name)) error('Unknown or repeated command option.');
    if (name === 'force') options[name] = true;
    else {
      if (i + 1 >= rest.length || rest[i + 1].startsWith('--')) error(`--${name} requires a value.`);
      options[name] = rest[++i];
    }
  }
  if (!options.session) error('--session <file> is required.');
  return { command, options };
}
async function readBounded(filename) {
  const stats = await fs.stat(filename);
  if (stats.size > MAX_SESSION_BYTES) error('The input file is too large (maximum 512 KiB).');
  const text = await fs.readFile(filename, 'utf8');
  if (Buffer.byteLength(text) > MAX_SESSION_BYTES) error('The input file is too large (maximum 512 KiB).');
  return text;
}
async function atomicWrite(filename, text, overwrite) {
  const target = path.resolve(filename);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, text, { flag: 'wx', mode: 0o600 });
    if (overwrite) await fs.rename(temporary, target);
    else await fs.link(temporary, target); // Atomic no-replace publication, including a racing creator.
  } catch (failure) {
    if (failure.code === 'EEXIST') error('The output already exists. Use --force only if you intend to replace it.');
    throw failure;
  } finally {
    await fs.unlink(temporary).catch(failure => { if (failure.code !== 'ENOENT') throw failure; });
  }
}
async function sameFile(left, right) {
  const resolve = async name => {
    try { return await fs.realpath(path.resolve(name)); }
    catch (failure) { if (failure.code !== 'ENOENT') throw failure; return path.resolve(name); }
  };
  const [a, b] = await Promise.all([resolve(left), resolve(right)]);
  const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (comparable(a) === comparable(b)) return true;
  try {
    const [sa, sb] = await Promise.all([fs.stat(a), fs.stat(b)]);
    return sa.dev === sb.dev && sa.ino === sb.ino;
  } catch (failure) { if (failure.code !== 'ENOENT') throw failure; return false; }
}
async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (command === 'start') {
    const session = createSession(options.mode || 'essential');
    await atomicWrite(options.session, JSON.stringify(session, null, 2) + '\n', !!options.force);
    return { ok: true, command, session: path.resolve(options.session), next: getNextQuestion(session) };
  }
  let session = validateSession(await readBounded(options.session));
  if (command === 'next') return { ok: true, command, question: getNextQuestion(session) };
  if (command === 'status') {
    const active = getQuestions(session);
    return { ok: true, command, mode: session.mode, active: active.length,
      answered: active.filter(q => Object.hasOwn(session.answers, q.id)).length,
      skipped: active.filter(q => session.skipped.includes(q.id)).length,
      next: getNextQuestion(session), status: 'Interview intent only; no setup performed' };
  }
  if (command === 'export') {
    if (!options.out) error('--out <file> is required.');
    if (await sameFile(options.out, options.session)) error('Export output must be different from the session file.');
    const format = options.format || 'markdown';
    if (!['markdown','setup-json','session-json'].includes(format)) error('Export format must be markdown, setup-json or session-json.');
    const output = format === 'markdown' ? buildProfile(session) : JSON.stringify(format === 'setup-json' ? buildSetupPlan(session) : session, null, 2) + '\n';
    await atomicWrite(options.out, output, !!options.force);
    return { ok: true, command, format, output: path.resolve(options.out) };
  }
  if (command === 'answer') {
    if (!options.id) error('--id <question-id> is required.');
    if (Object.hasOwn(options, 'value') === Object.hasOwn(options, 'value-file')) error('Supply exactly one of --value or --value-file containing a JSON value.');
    const raw = options['value-file'] ? await readBounded(options['value-file']) : options.value;
    let value;
    try { value = JSON.parse(raw); } catch { error('The answer must be a JSON value, such as "your answer" or ["listed option"].'); }
    session = answerQuestion(session, options.id, value);
  } else if (command === 'skip') {
    if (!options.id) error('--id <question-id> is required.');
    session = skipQuestion(session, options.id);
  } else if (command === 'mode') {
    if (!options.mode) error('--mode essential|deep is required.');
    session = validateSession({ ...session, mode: options.mode, updatedAt: new Date(Math.max(Date.now(), Date.parse(session.updatedAt))).toISOString() });
  }
  session = validateSession(session);
  await atomicWrite(options.session, JSON.stringify(session, null, 2) + '\n', true);
  return { ok: true, command, next: getNextQuestion(session) };
}
try {
  process.stdout.write(JSON.stringify(await main()) + '\n');
} catch (failure) {
  process.stdout.write(JSON.stringify({ ok: false, error: failure.message || 'The command failed.' }) + '\n');
  process.exitCode = 1;
}
