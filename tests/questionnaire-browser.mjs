// Optional real-browser questionnaire coverage. Synthetic answers only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL
  ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!/^(file|data|blob):/.test(request.url())) requests.push(request.url());
  });
  await page.goto(pathToFileURL(path.join(root, 'web/index.html')).href);
  const go = async title => {
    await page.locator('#steps .pip').filter({ hasText: title }).click();
    assert.deepEqual(errors, [], 'questionnaire must render without script errors');
  };
  const fill = async (id, text) => page.locator(`[data-fid="${id}"]`).fill(text);
  const row = async (id, text) => page.locator(`[data-rfid="${id}"]`).first().fill(text);

  await fill('identity.personalValues', 'VALUE_BROWSER_EXAMPLE');
  await go('Projects & Workflows');
  await page.locator('[data-add="projects.activeProjects"]').click();
  assert.equal(await page.locator('[data-rfid="projects.activeProjects.name"]').count(), 2,
    'Add must create a second row even before the initial row is filled');
  await page.locator('.repeater[data-fid="projects.activeProjects"] .repeater-remove').nth(1).click();
  await row('projects.activeProjects.name', 'PROJECT_BROWSER_EXAMPLE');
  await row('projects.activeProjects.outcome', 'OUTCOME_BROWSER_EXAMPLE');
  await row('projects.activeProjects.deadline', '2030-06-01');
  await fill('projects.priorityRules', 'PRIORITY_BROWSER_EXAMPLE');
  await page.locator('[data-add="projects.activeProjects"]').click();
  assert.equal(await page.locator('[data-rfid="projects.activeProjects.name"]').count(), 2);
  await page.locator('[data-rfid="projects.activeProjects.name"]').nth(1).fill('SECOND_PROJECT_EXAMPLE');
  await page.reload();
  assert.equal(await page.locator('[data-rfid="projects.activeProjects.name"]').first().inputValue(), 'PROJECT_BROWSER_EXAMPLE');
  assert.equal(await page.locator('[data-rfid="projects.activeProjects.name"]').nth(1).inputValue(), 'SECOND_PROJECT_EXAMPLE');
  assert.equal(await page.locator('[data-fid="projects.priorityRules"]').inputValue(), 'PRIORITY_BROWSER_EXAMPLE');
  console.log('PASS project detail, multiple rows, saved answers and step restored after reload');

  if (process.env.SOULMATE_SCREENSHOT_DIR) {
    const output = path.resolve(process.env.SOULMATE_SCREENSHOT_DIR);
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'questionnaire-projects.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile page must not overflow horizontally');
    const columns = await page.locator('.repeater .two').first().evaluate(el => getComputedStyle(el).gridTemplateColumns);
    assert.equal(columns.trim().split(/\s+/).length, 1, 'mobile repeater must use one column');
    await page.screenshot({ path: path.join(output, 'questionnaire-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  await go('Content & Audience');
  await fill('content.audience', 'AUDIENCE_BROWSER_EXAMPLE');
  await row('content.contentPillars.topic', 'TOPIC_BROWSER_EXAMPLE');
  await go('Health & Wellbeing');
  await fill('wellbeing.supportGoals', 'WELLBEING_BROWSER_EXAMPLE');
  await row('wellbeing.routines.activity', 'ROUTINE_BROWSER_EXAMPLE');
  await go('Family & Lifestyle');
  await row('lifestyle.familyResponsibilities.responsibility', 'FAMILY_BROWSER_EXAMPLE');
  await fill('lifestyle.leisureInterests', 'LEISURE_BROWSER_EXAMPLE');
  await go('Goals & Interests');
  await row('goals.topGoals.goal', 'GOAL_BROWSER_EXAMPLE');
  await row('goals.topGoals.successMeasure', 'MEASURE_BROWSER_EXAMPLE');
  await go('Memory & Knowledge');
  await row('memory.knowledgePaths.path', '/example/notes');
  await go('Your Fleet');
  await go('Review & Deploy');
  assert.deepEqual(errors, []);
  const ready = page.waitForEvent('download');
  await page.locator('#dl-sh').click();
  const download = await ready;
  assert.equal(await download.failure(), null);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const script = Buffer.concat(chunks).toString('utf8');
  for (const marker of ['VALUE_BROWSER_EXAMPLE', 'PRIORITY_BROWSER_EXAMPLE', '/example/notes',
    'PROJECT_BROWSER_EXAMPLE', 'OUTCOME_BROWSER_EXAMPLE', 'SECOND_PROJECT_EXAMPLE',
    'AUDIENCE_BROWSER_EXAMPLE', 'TOPIC_BROWSER_EXAMPLE', 'WELLBEING_BROWSER_EXAMPLE',
    'ROUTINE_BROWSER_EXAMPLE', 'FAMILY_BROWSER_EXAMPLE', 'LEISURE_BROWSER_EXAMPLE', 'MEASURE_BROWSER_EXAMPLE']) {
    assert.ok(script.includes(marker), `download must retain ${marker}`);
  }
  assert.deepEqual(requests, [], 'questionnaire must remain offline');
  console.log('PASS new sections, extended goal details and note folders render and reach the download');
  console.log('PASS no browser errors or external requests');
} finally {
  await browser.close();
}
