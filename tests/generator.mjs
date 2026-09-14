#!/usr/bin/env node
// Behavioral checks against the actual offline browser generator. Synthetic data only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const embedded = html.match(/<script\s+id="content-pack"\s+type="application\/json">([\s\S]*?)<\/script>/)[1];
const engine = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(s => s.includes('// === STATE ===')).split('// === NAV ===')[0];
const context = vm.createContext({
  document: { getElementById: () => ({ textContent: embedded }) },
  localStorage: { setItem() {}, getItem() { return null; } },
  TextEncoder, Blob, Intl, console,
});
const run = code => vm.runInContext(code, context);
run(engine);
run(`state.fleet = ['same','same','same-2','Same!','東京','','x'.repeat(40),'x'.repeat(40)].map(name => ({...makeAgent(ROLES[0], 'test'), name}));`);
const names = JSON.parse(run('JSON.stringify(normalizeAgents(state.fleet).map(a=>a.name))'));
assert.equal(new Set(names).size, names.length);
assert.equal(names[1], 'same 3');
assert.equal(names[2], 'same-2');
assert.deepEqual(JSON.parse(run('JSON.stringify(normalizeAgents(normalizeAgents(state.fleet)).map(a=>a.name))')), names);
const exportFiles = () => JSON.parse(run('JSON.stringify(genAll())'));
let files = exportFiles();
assert.equal(new Set(files.map(f => f.path)).size, files.length);
assert.deepEqual(exportFiles(), files);
assert.throws(() => run(`makeZip([{name:'duplicate',text:'1'},{name:'duplicate',text:'2'}])`), /Duplicate ZIP/);
assert.ok(run(`makeZip(genAll().map(f=>({name:f.path,text:f.content}))).size`) > 0);
console.log('PASS normalized identities, repeatable exports and unique ZIP entries');

// All per-profile files must respect each privacy tier, not just USER.md.
const tiers = ['fleet-visible', 'specific-agents', 'isolated'];
for (const required of tiers) {
  for (const granted of tiers) {
    run(`state.answers = {'identity.fullName':'IDENTITY_SENTINEL', 'identity.preferredName':'IDENTITY_SENTINEL', 'identity.household':[{name:'IDENTITY_SENTINEL'}], 'work.keyPeople':[{name:'WORK_SENTINEL'}], 'work.humanZone':'WORK_SENTINEL', 'goals.topGoals':[{goal:'GOAL_SENTINEL'}], 'assets.machines':[{name:'ASSET_SENTINEL', permission:'off-limits'}]};
      state.ownerName='IDENTITY_SENTINEL'; state.skipped={};
      state.tiers={identity:${JSON.stringify(required)},work:${JSON.stringify(required)},goals:${JSON.stringify(required)},assets:${JSON.stringify(required)}};
      state.fleet=[{...makeAgent(ROLES[0],'test'),name:'test',tier:${JSON.stringify(granted)}}];`);
    const profile = exportFiles().filter(f => f.path.startsWith('profiles/')).map(f => f.content).join('\n');
    const visible = required === 'fleet-visible' || granted === 'isolated' || required === granted;
    for (const marker of ['IDENTITY_SENTINEL', 'WORK_SENTINEL', 'GOAL_SENTINEL', 'ASSET_SENTINEL']) {
      assert.equal(profile.includes(marker), visible, `${required} -> ${granted}: ${marker}`);
    }
  }
}
run(`state.skipped={identity:true,work:true,goals:true,assets:true};`);
assert.doesNotMatch(exportFiles().filter(f => f.path.startsWith('profiles/')).map(f => f.content).join('\n'), /(?:IDENTITY|WORK|GOAL|ASSET)_SENTINEL/);
run(`state.skipped={}; state.tiers={identity:'isolated',work:'fleet-visible'}; state.fleet[0].tier='fleet-visible';`);
assert.match(run('genUserMd(state.fleet[0])'), /WORK_SENTINEL/);
assert.doesNotMatch(run('genUserMd(state.fleet[0])'), /IDENTITY_SENTINEL/);
assert.doesNotMatch(run('genFleetKnowledgeMd(state.fleet)'), /IDENTITY_SENTINEL/);
run(`state.skipped.work=true;`);
assert.equal(run("getFieldAnswer('work','humanZone')"), 'WORK_SENTINEL');
assert.doesNotMatch(run('genUserMd(state.fleet[0])'), /WORK_SENTINEL/);
run(`setFieldAnswer('work','humanZone','RESUMED_WORK');`);
assert.equal(run('!!state.skipped.work'), false);
assert.match(run('genUserMd(state.fleet[0])'), /RESUMED_WORK/);
console.log('PASS all profile content across nine tier combinations, independent work visibility and skipped sections');

run(`state.answers={'goals.monitorDomains':['DERIVED_PRIVATE_GOAL']}; state.tiers={goals:'isolated'}; state.skipped={};
  state.fleet=[{...makeAgent(ROLES.find(r=>r.id==='researcher'),'test'),name:'research',tier:'fleet-visible'}];`);
assert.match(run('state.fleet[0].mission'), /DERIVED_PRIVATE_GOAL/);
assert.doesNotMatch(exportFiles().filter(f=>f.path.startsWith('profiles/')).map(f=>f.content).join('\n'), /DERIVED_PRIVATE_GOAL/);
run(`state.fleet[0].mission='EXPLICIT_MISSION_FOR_THIS_AGENT'; state.fleet[0].missionEdited=true;`);
assert.match(run('genProfileYaml(state.fleet[0])'), /EXPLICIT_MISSION_FOR_THIS_AGENT/);
assert.match(run('genSoulMd(state.fleet[0])'), /EXPLICIT_MISSION_FOR_THIS_AGENT/);
assert.doesNotMatch(run('genSoulMd(state.fleet[0])'), /DERIVED_PRIVATE_GOAL/);
console.log('PASS explicit custom missions retained while private derived goals remain filtered');

run(`state.answers={'guardrails.redLines':['move-money'],'rhythm.petPeeves':'avoid AI slop'}; state.skipped={}; state.fleet[0].tools=['email','github','discord']; state.fleet[0].roleId='researcher';`);
assert.doesNotMatch(run('genEnvExample(state.fleet[0])'), /EMAIL_PASSWORD=|GITHUB_TOKEN=|DISCORD_BOT_TOKEN=/);
assert.match(run('genSoulMd(state.fleet[0])'), /Additional communication instructions: avoid AI slop/);
assert.match(run('genSoulMd(state.fleet[0])'), /moving money or making payments/);
assert.equal(JSON.parse(run('genCronJson(state.fleet[0])')).enabled, false);
const hostile = "single' double\" $(touch SENTINEL_EXECUTED) `touch SENTINEL_EXECUTED` $&\n" +
  Array.from({ length: 30 }, (_, i) => 'SOULMATE_LITERAL_' + i).join('\n') + '\nEOF_SOUL_MD_TEST\n<!-- </script>';
context.hostile = hostile;
assert.equal(JSON.parse(run('yVal(hostile)')), hostile);
run(`state.ownerName=hostile; state.tiers={identity:'fleet-visible',work:'fleet-visible',goals:'fleet-visible'};
  state.answers={'identity.fullName':hostile,'rhythm.petPeeves':hostile,'goals.topGoals':[{goal:hostile}]};
  state.fleet=[{...makeAgent(ROLES[0],'test'), name:hostile, model:hostile, schedule:'0 9 * * *'}];`);
assert.ok(run('fillVars("{{ownerName}}",state.fleet[0])').includes(hostile));
files = exportFiles();
console.log('PASS literal user strings, model scalar encoding, credential boundaries and disabled schedules');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'soulmate-generator-'));
try {
  // Exercise the real build tool on a disposable copy with hostile JSON strings.
  for (const directory of ['tools', 'content', 'web']) fs.mkdirSync(path.join(temp, directory));
  fs.copyFileSync(path.join(root, 'tools/build.mjs'), path.join(temp, 'tools/build.mjs'));
  const pack = JSON.parse(embedded); pack.hostileTest = hostile;
  fs.writeFileSync(path.join(temp, 'content/content-pack.json'), JSON.stringify(pack));
  fs.writeFileSync(path.join(temp, 'web/index.html'), html);
  for (const args of [[], ['--check']]) {
    const result = spawnSync(process.execPath, [path.join(temp, 'tools/build.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const rebuilt = fs.readFileSync(path.join(temp, 'web/index.html'), 'utf8').match(/<script\s+id="content-pack"\s+type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(rebuilt).hostileTest, hostile);
  assert.ok(!rebuilt.includes('<'));
  pack.hostileTest += 'drift';
  fs.writeFileSync(path.join(temp, 'content/content-pack.json'), JSON.stringify(pack));
  assert.equal(spawnSync(process.execPath, [path.join(temp, 'tools/build.mjs'), '--check']).status, 1);
  console.log('PASS build hostile JSON roundtrip and semantic drift detection');

  const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
  if (!fs.existsSync(shell)) {
    console.log('SKIP shell checks: POSIX shell unavailable');
  } else {
    const script = path.join(temp, 'setup-fleet.sh');
    fs.writeFileSync(script, files.find(f => f.path === 'setup-fleet.sh').content);
    const home = path.join(temp, "isolated home ' dollar $");
    const environment = { ...process.env, HERMES_HOME: home, HOME: path.join(temp, 'unused-home') };
    const installedName = run('slugify(normalizeAgents(state.fleet)[0].name)');
    for (let iteration = 0; iteration < 3; iteration++) {
      const result = spawnSync(shell, [script.replaceAll('\\', '/')], { env: environment, cwd: temp, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      for (const file of files.filter(f => f.path.startsWith('profiles/') || ['fleet.yaml', 'FLEET-KNOWLEDGE.md', 'DEPLOYMENT.md'].includes(f.path))) {
        assert.equal(fs.readFileSync(path.join(home, file.path), 'utf8'), file.content, file.path);
      }
      assert.equal(fs.existsSync(path.join(temp, 'SENTINEL_EXECUTED')), false);
      fs.writeFileSync(path.join(home, 'profiles', installedName, '.env'), 'SYNTHETIC_BACKUP_SENTINEL=' + iteration);
    }
    for (const suffix of ['.bak.1', '.bak.2']) {
      assert.ok(fs.existsSync(path.join(home, 'profiles', installedName + suffix, 'SOUL.md')));
      assert.ok(fs.existsSync(path.join(home, 'fleet.yaml' + suffix)));
      assert.ok(fs.existsSync(path.join(home, 'FLEET-KNOWLEDGE.md' + suffix)));
      assert.ok(fs.existsSync(path.join(home, 'DEPLOYMENT.md' + suffix)));
      assert.equal(fs.readFileSync(path.join(home, 'profiles', installedName + suffix, '.env'), 'utf8'),
        'SYNTHETIC_BACKUP_SENTINEL=' + (Number(suffix.at(-1)) - 1));
    }
    assert.ok(fs.existsSync(path.resolve(home, 'profiles', installedName, '../../FLEET-KNOWLEDGE.md')));
    console.log('PASS isolated shell roundtrip, sentinel non-execution, shared documents and repeated backup preservation');
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
