#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const embedded = html.match(/<script\s+id="content-pack"\s+type="application\/json">([\s\S]*?)<\/script>/)[1];
const pack = JSON.parse(embedded);
const engine = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(s => s.includes('// === STATE ===')).split('// === NAV ===')[0];
let stored = null;
const context = vm.createContext({ document: { getElementById: () => ({ textContent: embedded }) },
  localStorage: { setItem(key, value) { stored = value; }, getItem() { return stored; } },
  TextEncoder, Blob, Intl, console });
const run = code => vm.runInContext(code, context);
run(engine);
const additions = {
  projects: ['activeProjects','recurringWorkflows','priorityRules','workingConstraints','deliverablePreferences','followUpRules'],
  content: ['audience','contentPillars','voiceExamples','avoidTopics','publishingPlan','successMeasures'],
  wellbeing: ['supportGoals','routines','sleepPreferences','foodPreferences','activityPreferences','trackingSources'],
  lifestyle: ['familyResponsibilities','travelPreferences','leisureInterests','learningGoals','householdRoutines','personalBoundaries'],
  identity: ['personalValues','decisionStyle','accessibilityPreferences'], work: ['idealCustomer','businessPriorities'],
  goals: ['nearTermFocus','successDefinition'], memory: ['trustedSources','rememberPreferences','doNotRetain'],
  rhythm: ['urgentAlerts','checkInPreferences'],
};
assert.equal(Object.values(additions).flat().length, 36);
assert.equal(pack.steps.length, 14);
for (const [id, fields] of Object.entries(additions)) {
  const step = pack.steps.find(s => s.id === id);
  for (const field of fields) {
    const metadata = step.fields.find(f => f.id === field);
    assert.ok(metadata?.contextExport, `${id}.${field} exports context`);
    assert.equal(metadata.required, false);
  }
  if (['projects','content','wellbeing','lifestyle'].includes(id)) {
    assert.equal(step.fields.length, 6);
    assert.equal(step.sensitivity, true);
    assert.equal(step.skippable, true);
  }
}
const extended = { 'goals.topGoals': ['deadline','successMeasure','currentBaseline','nextMilestone','obstacle','timeAvailable'],
  'assets.socialAccounts': ['audience','objective'] };
for (const [ref, ids] of Object.entries(extended)) {
  const [stepId, fieldId] = ref.split('.');
  const field = pack.steps.find(s => s.id === stepId).fields.find(f => f.id === fieldId);
  assert.ok(field.contextExport);
  for (const id of ids) assert.ok(field.fields.find(f => f.id === id));
}
console.log('PASS 36 optional questions, four sections and eight extended repeater fields');

// Each new question and every repeater subfield carries a unique marker into USER.md.
let markersChecked = 0;
for (const step of pack.steps) {
  for (const field of step.fields.filter(f => f.contextExport)) {
    const subfields = field.fields || field.itemFields;
    const markers = subfields ? subfields.map(f => `SENTINEL_${step.id}_${field.id}_${f.id}`) : [`SENTINEL_${step.id}_${field.id}`];
    const value = subfields ? [Object.fromEntries(subfields.map((f, i) => [f.id, f.type === 'multiselect' ? [markers[i]] : markers[i]]))] : markers[0];
    context.fixture = { ref: step.id + '.' + field.id, value };
    run(`state.answers={[fixture.ref]:fixture.value};state.skipped={};state.tiers={};state.fleet=[{...makeAgent(ROLES[0],'test'),name:'eligible',tier:'isolated'}];`);
    const user = run('genUserMd(state.fleet[0])');
    for (const marker of markers) assert.ok(user.includes(marker), `${fixtureLabel(step,field)}: ${marker}`);
    assert.doesNotMatch(user, /\[object Object\]|undefined/);
    const soul = run('genSoulMd(state.fleet[0])');
    // Legacy goal title itself can appear in SOUL, but new detailed fields do not.
    if (additions[step.id]?.includes(field.id)) for (const marker of markers) assert.ok(!soul.includes(marker));
    for (const marker of markers) assert.ok(!run('genFleetKnowledgeMd(state.fleet)').includes(marker));
    if (step.sensitivity) {
      run(`state.fleet[0].tier='fleet-visible';`);
      for (const marker of markers) {
        assert.ok(!run('genUserMd(state.fleet[0])').includes(marker));
        assert.ok(!run('genSoulMd(state.fleet[0])').includes(marker));
      }
    }
    run(`state.fleet[0].tier='isolated';state.skipped[fixture.ref.split('.')[0]]=true;`);
    for (const marker of markers) assert.ok(!run('genUserMd(state.fleet[0])').includes(marker));
    markersChecked += markers.length;
  }
}
function fixtureLabel(step, field) { return step.id + '.' + field.id; }
console.log(`PASS ${markersChecked} distinct field/subfield markers: eligible export, privacy and skip filtering`);

assert.equal(run(`formatContextValue({type:'select',options:[{value:'code',label:'Readable label'}]},'code')`), 'Readable label');
assert.equal(run(`formatContextValue({type:'multiselect',options:[{value:'code',label:'Readable label'}]},['code'])`), 'Readable label');
assert.equal(run(`formatContextValue({type:'toggle'},false)`), 'No');
assert.equal(run(`formatContextValue({type:'toggle',default:true},undefined)`), '');
assert.equal(run(`formatContextValue({type:'repeater',itemFields:[{id:'flag',label:'A flag',type:'toggle'}]},[{flag:false}])`), 'Entry 1\n- A flag: No');
run(`state.answers={};state.skipped={};state.fleet=null;`);
const baselineRoles = run('JSON.stringify(deriveFleet().map(a=>a.roleId))');
for (const step of pack.steps) for (const field of step.fields.filter(f => f.type === 'repeater')) {
  context.repeatFixture = { step, field };
  const rendered = run('renderRepeater(repeatFixture.step,repeatFixture.field)');
  assert.ok(!rendered.includes('grid-template-columns:1fr 1fr'));
  assert.equal(run('state.answers[repeatFixture.step.id+"."+repeatFixture.field.id]'), undefined);
}
assert.equal(run('JSON.stringify(deriveFleet().map(a=>a.roleId))'), baselineRoles);
assert.ok(run('genAll().length') > 0);
assert.equal(run('genDetailedContext(state.fleet[0])'), '');
run(`state.skipped=Object.fromEntries(STEPS.map(s=>[s.id,true]));state.fleet=null;`);
assert.ok(run('genAll().length') > 0);
console.log('PASS readable labels, deliberate false, itemFields, no invented defaults and blank/all-skip exports');

const originalDocument = context.document;
const addButton = { dataset: { add: 'projects.activeProjects' } };
context.document = { getElementById: () => ({ querySelectorAll: selector => selector === '.repeater-add' ? [addButton] : [] }) };
run(`state.answers={};state.skipped={};const savedRenderStep=renderStep;renderStep=()=>{};
  attachFieldListeners(STEPS.find(s=>s.id==='projects'));`);
addButton.onclick();
assert.equal(run('JSON.stringify(state.answers["projects.activeProjects"])'), '[{},{}]');
assert.equal(run('genDetailedContext(state.fleet[0])'), '');
run('renderStep=savedRenderStep;');
context.document = originalDocument;
console.log('PASS first Add preserves the visible empty row and appends a second row without defaults');

const recommendations = {
  'wellbeing.supportGoals': ['health-companion','test'], 'wellbeing.routines': ['health-companion',[{activity:'Walk'}]],
  'lifestyle.familyResponsibilities': ['family-ops',[{responsibility:'School pickup'}]],
  'content.audience': ['content-publisher','Readers'], 'content.publishingPlan': ['social-media',[{platform:'Blog'}]],
  'projects.activeProjects': ['business-ops',[{name:'A project'}]], 'projects.recurringWorkflows': ['business-ops',[{name:'Weekly report'}]],
  'work.businessPriorities': ['business-ops','Customer support'], 'lifestyle.learningGoals': ['learning-coach',[{topic:'History'}]],
  'lifestyle.travelPreferences': ['travel-planner','Rail travel'],
};
for (const [ref, [role, value]] of Object.entries(recommendations)) {
  context.recommendation = { ref, value };
  run(`state.answers={[recommendation.ref]:recommendation.value};state.skipped={};`);
  const roles = JSON.parse(run('JSON.stringify(deriveFleet().map(a=>a.roleId))'));
  assert.ok(roles.includes(role), ref);
  assert.equal(new Set(roles).size, roles.length);
  run(`state.skipped[recommendation.ref.split('.')[0]]=true;`);
  assert.ok(!JSON.parse(run('JSON.stringify(deriveFleet().map(a=>a.roleId))')).includes(role));
}
console.log('PASS recommendations respond to relevant answers, stay unique and respect skipped sections');

for (const [oldIndex, id] of ['identity','assets','resources','memory','work','goals','guardrails','rhythm','fleet','review'].entries()) {
  stored = JSON.stringify({ currentStep: oldIndex, answers: { 'goals.topGoals': [{ goal: 'OLD_GOAL' }] },
    fleet: [{ name: 'MY_CUSTOM_FLEET', mission: 'CUSTOM_MISSION', missionEdited: true }] });
  run('load()');
  assert.equal(run('STEPS[state.currentStep].id'), id);
  assert.equal(run("state.answers['goals.topGoals'][0].goal"), 'OLD_GOAL');
  assert.equal(run('state.fleet[0].name'), 'MY_CUSTOM_FLEET');
  assert.equal(run('state.fleet[0].mission'), 'CUSTOM_MISSION');
}
run(`state.currentStep=STEPS.findIndex(s=>s.id==='wellbeing');save();state.currentStep=0;load();`);
assert.equal(run('STEPS[state.currentStep].id'), 'wellbeing');
assert.equal(JSON.parse(stored).currentStepId, 'wellbeing');
console.log('PASS all ten legacy step positions, saved answers, custom fleet and new section progress survive migration');
