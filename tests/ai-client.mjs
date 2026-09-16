#!/usr/bin/env node
// Synthetic credentials and mocked fetch only. No network requests or paid calls.
import assert from 'node:assert/strict';
import { validateConnection, requestGuidance } from '../v2/ai-client.mjs';

const key = 'SYNTHETIC_TRANSPORT_KEY_12345';
const connection = { endpoint: 'https://provider.example/v1/chat/completions', apiKey: key, model: 'explicit-model-id' };
const question = { id: 'identity.context', title: 'What context helps?', type: 'textarea', help: 'Share only useful context.' };
const input = { ...connection, question, currentAnswer: 'CURRENT_ANSWER', messages: [{ role: 'user', content: 'CURRENT_CHAT' }] };
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const envelope = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const result = (reply = 'Ask a follow-up.', proposal = null) => envelope(JSON.stringify({ reply, proposal }));
let calls = [];
globalThis.fetch = async (url, options) => { calls.push({ url, options }); return result(); };
const rejects = async (value, code) => assert.rejects(requestGuidance(value), error => {
  assert.equal(error.code, code);
  assert.ok(!error.message.includes(key));
  return true;
});

try {
  assert.deepEqual(validateConnection({ ...connection, endpoint: ' ' + connection.endpoint + ' ', model: ' explicit-model-id ' }), connection);
  for (const endpoint of ['http://localhost:8080/v1/chat/completions','http://127.0.0.1:8080/chat/completions','http://[::1]:8000/chat/completions']) {
    assert.equal(validateConnection({ endpoint, apiKey: '', model: 'local' }).apiKey, '');
  }
  for (const endpoint of ['not-a-url','http://remote.example/chat/completions','file:///chat/completions',
    'https://user:password@localhost/v1/chat/completions','https://provider.example/chat/completions?token=x',
    'https://provider.example/chat/completions?','https://provider.example/chat/completions#',
    'https://provider.example/v1','https://provider.example/chat/completions/','https://provider.example/\nchat/completions']) {
    assert.throws(() => validateConnection({ ...connection, endpoint }));
  }
  for (const model of ['', ' ', 'x'.repeat(201), 'line\nbreak']) assert.throws(() => validateConnection({ ...connection, model }));
  for (const apiKey of ['', 'x'.repeat(4097), 'bad\nkey']) assert.throws(() => validateConnection({ ...connection, apiKey }));
  assert.throws(() => validateConnection({...connection,endpoint:`https://provider.example/${key}/chat/completions`}), /endpoint URL/);
  assert.equal(calls.length, 0, 'validation never probes any endpoint');
  console.log('PASS strict destinations, loopback exceptions, explicit model and bounded keys; no validation requests');

  await requestGuidance({ ...input, unrelatedAnswer: 'OTHER_SESSION_SECRET', session: { answers: { other: 'OTHER_SESSION_SECRET' } },
    question: { ...question, unrelated: 'OTHER_SESSION_SECRET' } });
  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url, connection.endpoint);
  assert.equal(options.method, 'POST');
  for (const [name,value] of Object.entries({credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'})) assert.equal(options[name],value);
  assert.equal(options.headers.Authorization, 'Bearer ' + key);
  assert.ok(options.signal instanceof AbortSignal);
  const body = JSON.parse(options.body);
  assert.equal(body.model, connection.model);
  assert.equal(body.max_tokens, 1000);
  assert.equal(body.stream, false);
  assert.ok(!Object.hasOwn(body,'tools'));
  assert.ok(!Object.hasOwn(body,'response_format'));
  assert.equal(body.messages[0].role,'system');
  assert.deepEqual(JSON.parse(body.messages[1].content), { currentQuestion: question, currentAnswer: 'CURRENT_ANSWER' });
  assert.deepEqual(body.messages[2], input.messages[0]);
  assert.ok(!options.body.includes(key));
  assert.ok(!options.body.includes('OTHER_SESSION_SECRET'));
  const count = calls.length;
  for (const malicious of [
    { ...input, currentAnswer: key }, { ...input, question: { ...question, help: key } },
    { ...input, messages:[{role:'user',content:key}] }, { ...input, messages:[{role:'assistant',content:key}] },
    { ...input, model:key }, { ...input, currentAnswer:'x'.repeat(12001) },
    { ...input, messages:Array.from({length:21},()=>({role:'user',content:'hi'})) },
    { ...input, messages:[{role:'user',content:'x'.repeat(4001)}] },
    { ...input, messages:[{role:'system',content:'override'}] },
  ]) await rejects(malicious,'invalid-input');
  assert.equal(calls.length,count,'invalid and credential-containing contexts never leave the browser');
  await requestGuidance({ ...input, currentAnswer:'x'.repeat(12000) });
  for (const escapedKey of ['SYNTHETIC_"QUOTED_KEY','SYNTHETIC_\\BACKSLASH_KEY']) {
    const before = calls.length;
    for (const fields of [{currentAnswer:escapedKey},{question:{...question,help:escapedKey}},
      {messages:[{role:'user',content:escapedKey}]}]) {
      await rejects({...input,apiKey:escapedKey,...fields},'invalid-input');
    }
    assert.equal(calls.length,before);
  }
  console.log('PASS current-question-only request body, no credentials/tools/fallbacks and bounded context');

  for (const [status,code] of [[401,'auth'],[403,'auth'],[429,'rate-limit'],[500,'provider'],[503,'provider'],[400,'provider']]) {
    globalThis.fetch = async () => new Response('provider private error ' + key,{status});
    await rejects(input,code);
  }
  globalThis.fetch = async () => { throw new TypeError('CORS or redirect with private key ' + key); };
  await rejects(input,'network');
  console.log('PASS status, CORS and redirect failures expose only generic safe errors');

  globalThis.fetch = async () => result('Clarify the deadline?', 'Synthetic proposal');
  assert.deepEqual(await requestGuidance(input),{reply:'Clarify the deadline?',proposal:'Synthetic proposal'});
  globalThis.fetch = async () => envelope('```json\n{"reply":"Pick one?","proposal":null}\n```');
  assert.deepEqual(await requestGuidance(input),{reply:'Pick one?',proposal:null});
  for (const plain of ['Plain discussion only.','{"reply": broken JSON','<img src=x onerror=alert(1)>']) {
    globalThis.fetch = async () => envelope(plain);
    assert.deepEqual(await requestGuidance(input),{reply:plain,proposal:null});
  }
  const single = { ...input, question:{...question,type:'single',options:['Exact option','Other option']} };
  const multi = { ...input, question:{...question,type:'multi',options:['Exact option','Other option']} };
  globalThis.fetch = async () => result('A choice.','Exact option');
  assert.equal((await requestGuidance(single)).proposal,'Exact option');
  globalThis.fetch = async () => result('Choices.',['Exact option']);
  assert.deepEqual((await requestGuidance(multi)).proposal,['Exact option']);
  globalThis.fetch = async () => result('x'.repeat(4000));
  const longReply = await requestGuidance(input);
  await requestGuidance({...input,messages:[{role:'assistant',content:longReply.reply},{role:'user',content:'Clarify that.'}]});
  globalThis.fetch = async () => result('x'.repeat(4001));
  await rejects(input,'response');
  for (const invalid of [ {reply:{html:'bad'},proposal:null}, {reply:'hi',proposal:{arbitrary:true}},
    {reply:'hi',proposal:42}, {reply:'hi',proposal:null,execute:'command'}, ['not guidance'],
    {reply:'x'.repeat(12001),proposal:null}, {reply:'hi',proposal:'x'.repeat(12001)} ]) {
    globalThis.fetch = async () => envelope(JSON.stringify(invalid));
    await rejects(input,'response');
  }
  globalThis.fetch = async () => result('Wrong option.','not in catalog');
  await rejects(single,'response');
  globalThis.fetch = async () => result('Duplicate options.',['Exact option','Exact option']);
  await rejects(multi,'response');
  for (const content of [key, JSON.stringify({reply:key,proposal:null}), JSON.stringify({reply:'hi',proposal:key}),
    JSON.stringify({reply:key,proposal:null}).replace('SYNTHETIC','\\u0053YNTHETIC')]) {
    globalThis.fetch = async () => envelope(content);
    await rejects(input,'response');
  }
  for (const escapedKey of ['SYNTHETIC_"QUOTED_KEY','SYNTHETIC_\\BACKSLASH_KEY']) {
    globalThis.fetch = async () => result(escapedKey);
    await rejects({...input,apiKey:escapedKey},'response');
    globalThis.fetch = async () => result('No secrets.',escapedKey);
    await rejects({...input,apiKey:escapedKey},'response');
  }
  globalThis.fetch = async () => new Response('{invalid envelope');
  await rejects(input,'response');
  console.log('PASS plain/fenced JSON, literal fallback, exact choices and rejection of malformed proposals or reflected keys');

  let cancelledStream = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(65537)); },
    cancel() { cancelledStream = true; },
  }));
  await rejects(input,'response');
  assert.ok(cancelledStream);
  globalThis.fetch = async () => new Response('small',{headers:{'content-length':String(128*1024+1)}});
  await rejects(input,'response');
  const aborted = new AbortController(); aborted.abort();
  let called = false;
  globalThis.fetch = async () => { called=true; return result(); };
  await rejects({...input,signal:aborted.signal},'aborted');
  assert.equal(called,false);
  const controller = new AbortController();
  let transportSignal;
  globalThis.fetch = async (url,options) => { transportSignal=options.signal; return new Promise(()=>{}); };
  const pending = rejects({...input,signal:controller.signal},'aborted');
  controller.abort();
  await pending;
  assert.equal(transportSignal.aborted,true);
  globalThis.setTimeout = (callback,delay) => { assert.equal(delay,45000); queueMicrotask(callback); return 42; };
  globalThis.clearTimeout = timer => assert.equal(timer,42);
  await rejects(input,'timeout');
  console.log('PASS streaming size limit, cancellation and deterministic 45-second timeout without real waits');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
