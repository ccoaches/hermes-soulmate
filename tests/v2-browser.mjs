import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createSession, getQuestions } from '../v2/interview.mjs';
import { createWizardServer } from '../v2/serve.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=createWizardServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const output=path.join(root,'output/playwright/v2');fs.mkdirSync(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/');await page.locator('#start').waitFor();await page.screenshot({path:path.join(output,'landing-desktop.png'),fullPage:true,animations:"disabled"});
 assert.ok((await page.locator('.brand').innerText()).includes('HERMES'));assert.equal(await page.locator('.orbit svg').count(),1);assert.equal(await page.locator('img').count(),0);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Landing fits mobile');await page.screenshot({path:path.join(output,'landing-mobile.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
 await page.locator('#start').click();
 const initial=getQuestions(createSession());
 const fill=async(q,value)=>{if(q.type==='text'||q.type==='textarea')await page.locator('#answer').fill(value);else for(const option of Array.isArray(value)?value:[value])await page.getByLabel(option,{exact:true}).check();};
 const sample=q=>q.type==='multi'?[q.options[0]]:q.type==='single'?q.options[0]:'SYNTHETIC_BROWSER_ANSWER';
 if(initial[0].required){await page.locator('[type=submit]').click();assert.ok(await page.locator('#field-error').textContent(),'Required answer must produce a visible error');}
 await fill(initial[0],sample(initial[0]));await page.locator('[type=submit]').click();
 assert.equal(await page.locator('#question-title').textContent(),initial[1].title);
 await page.locator('#back').click();
 if(initial[0].type==='text'||initial[0].type==='textarea')assert.equal(await page.locator('#answer').inputValue(),'SYNTHETIC_BROWSER_ANSWER');
 await page.locator('[type=submit]').click();
 if(!initial[1].required)await page.locator('#skip').click();else{await fill(initial[1],sample(initial[1]));await page.locator('[type=submit]').click();}
 if(await page.locator('#skip').count()){await page.locator('#skip').click();assert.ok((await page.locator('.progress-label').innerText()).includes('1 skipped'));}
 await page.screenshot({path:path.join(output,'question-desktop.png'),fullPage:true,animations:"disabled"});
 await page.reload();await page.locator('#start').click();
 await page.locator('#mobile-review').click();
 assert.ok((await page.locator('.review').innerText()).includes('SYNTHETIC_BROWSER_ANSWER'));
 await page.locator('[data-edit]').first().click();await fill(initial[0],sample(initial[0]));await page.locator('[type=submit]').click();await page.locator('.review').waitFor();
 const exported=page.waitForEvent('download');await page.locator('#export').click();const download=await exported;const filename=await download.path();const session=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(session.version,2);assert.ok(Object.keys(session.answers).length>0);
 const setupDownload=page.waitForEvent('download');await page.locator('#setup-json').click();const setup=JSON.parse(fs.readFileSync(await(await setupDownload).path(),'utf8'));assert.equal(setup.kind,'hermes-setup-intent');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#reset').click();await page.locator('#start').waitFor();
 await page.locator('#import-file').setInputFiles({name:'interview.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(session))});await page.locator('.review').waitFor();
 assert.ok((await page.locator('.review').innerText()).includes('SYNTHETIC_BROWSER_ANSWER'));
 await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Import failed'));
 await page.locator('#agent-open').click();await page.locator('#agent-dialog').waitFor({state:'visible'});const kitDownload=page.waitForEvent('download');await page.locator('#agent-kit').click();const kit=JSON.parse(fs.readFileSync(await(await kitDownload).path(),'utf8'));assert.equal(kit.kind,'hermes-agent-interview-kit');assert.equal(kit.version,1);assert.ok(kit.guide.includes('Instructions for the interviewing agent'));assert.ok(kit.questions.length>50);assert.deepEqual(kit.session.answers,session.answers);await page.locator('[data-close]').click();
 await page.reload();await page.locator('#review').click();
 await page.screenshot({path:path.join(output,'review-desktop.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.locator('#resume').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');await page.screenshot({path:path.join(output,'question-mobile.png'),fullPage:true,animations:"disabled"});
 await page.locator('#mobile-review').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Review fits mobile');
 await page.screenshot({path:path.join(output,'review-mobile.png'),fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS v2 real browser: answer, back, skip, reload, edit, import, exports, agent guide, mobile; no external requests');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
