import { questions, createSession, validateSession, getQuestions, getNextQuestion, answerQuestion, skipQuestion, buildProfile, buildSetupPlan } from './interview.mjs';
import { validateConnection, requestGuidance } from './ai-client.mjs';

const KEY = 'hermes-soulmate-v2';
const app = document.querySelector('#app');
let session = createSession(), currentId = null, screen = 'landing', editing = false, saved = false;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notice = message => { document.querySelector('#notice').textContent = message; };
try { const raw = localStorage.getItem(KEY); if (raw) { session = validateSession(JSON.parse(raw)); saved = true; } } catch (error) { notice(`Saved interview could not be loaded: ${error.message} Export your work regularly.`); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(session)); saved = true; notice(''); } catch { notice('Browser storage is unavailable. Your answers remain in this tab. Download your interview before leaving.'); } }
function download(filename, text, type) { const url = URL.createObjectURL(new Blob([text], {type})); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportSession() { download('hermes-interview.json', JSON.stringify(session, null, 2), 'application/json'); }
function focusTitle() { requestAnimationFrame(() => document.querySelector('main h1')?.focus({preventScroll:true})); }
const answered = q => Object.hasOwn(session.answers, q.id);
const emblem = `<div class="orbit" aria-hidden="true"><svg viewBox="0 0 800 800" fill="none"><circle cx="400" cy="400" r="345" stroke="currentColor" stroke-opacity=".2"/><circle cx="400" cy="400" r="282" stroke="currentColor" stroke-opacity=".15"/><circle cx="400" cy="400" r="212" stroke="currentColor" stroke-opacity=".25"/><path d="M400 32v736M32 400h736" stroke="currentColor" stroke-opacity=".12"/><g stroke="currentColor" stroke-width="2"><path d="M295 490V282l105 118 105-118v208M295 334l105 118 105-118M295 386l105 118 105-118"/><path d="M295 282 165 230l130 156M505 282l130-52-130 156M295 315l-87-34M505 315l87-34M295 349l-44-17M505 349l44-17"/></g><path d="m400 111 7 15-7 15-7-15zm0 548 7 15-7 15-7-15zM111 400l15-7 15 7-15 7zm548 0 15-7 15 7-15 7z" fill="currentColor"/><circle cx="400" cy="400" r="344" stroke="currentColor" stroke-dasharray="1 18" stroke-width="6" stroke-opacity=".5"/></svg></div>`;
function renderLanding() {
  invalidateAI();
  screen = 'landing';
  const counts = ['essential','deep'].map(mode => getQuestions(createSession(mode)).length);
  app.innerHTML = `<section class="landing">${emblem}<div class="hero-copy"><p class="eyebrow">HERMES SETUP · SOULMATE V2</p><h1 tabindex="-1">Your Hermes.<br><em>By design.</em></h1><p class="intro">Choose your models, memory, tools and routines. Build a setup that understands how you work.</p><div class="mode-picker"><label><input type="radio" name="mode" value="essential" ${session.mode==='essential'?'checked':''}><span><strong>The essentials</strong><small>${counts[0]} starting questions</small></span></label><label><input type="radio" name="mode" value="deep" ${session.mode==='deep'?'checked':''}><span><strong>The complete setup</strong><small>${counts[1]} starting questions · adapts to you</small></span></label></div><div class="button-row"><button class="primary" id="start">${saved?'Resume your setup':'Shape your Hermes'} <span aria-hidden="true">↗</span></button><button class="secondary" id="ai-start">Guide me with AI</button></div><div class="text-actions"><button class="quiet" id="import">Import interview</button>${saved?'<button class="quiet" id="review">Review answers</button>':''}</div><p class="fine">The plain wizard stays on your device. Optional AI guidance sends the current question and its chat directly to your chosen provider. We do not collect your answers. Never enter secrets in interview answers.</p></div></section>`;
  app.querySelector('#start').onclick = () => { session = validateSession({...session, mode:app.querySelector('[name=mode]:checked').value}); persist(); currentId = getNextQuestion(session)?.id ?? getQuestions(session)[0]?.id; renderQuestion(); };
  app.querySelector('#ai-start').onclick = () => { app.querySelector('#start').click(); openAI(); };
  app.querySelector('#import').onclick = importFile;
  app.querySelector('#review')?.addEventListener('click', renderReview);
}
function rail(active, list) {
  const chapters = [...new Set(list.map(q=>q.chapter))];
  const count = list.filter(answered).length, skips = list.filter(q=>session.skipped.includes(q.id)).length;
  return `<aside class="rail"><p class="eyebrow">YOUR SETUP</p><p class="progress-label">${count} <small>/ ${list.length} answered · ${skips} skipped</small></p><div class="progress-track" role="progressbar" aria-label="Questions answered" aria-valuenow="${count}" aria-valuemax="${list.length}" aria-valuemin="0"><span style="width:${list.length?count/list.length*100:0}%"></span></div><nav class="chapter-nav" aria-label="Interview chapters">${chapters.map((chapter,i)=>`<button class="chapter ${chapter===active?'active':''}" ${chapter===active?'aria-current="step"':''} data-chapter="${escape(chapter)}"><span class="chapter-number">${String(i+1).padStart(2,'0')}</span>${escape(chapter)}</button>`).join('')}</nav><div class="rail-bottom"><button class="quiet" id="review">Review & export ↗</button><button class="quiet" id="switch-mode">${session.mode==='essential'?'Explore complete setup':'Switch to essentials'}</button><button class="quiet" id="save-json">Download interview</button><button class="quiet" id="import">Import interview</button><button class="quiet" id="reset">Start over</button></div></aside>`;
}
function renderQuestion() {
  invalidateAI();
  screen = 'question';
  const list = getQuestions(session);
  const q = list.find(q=>q.id===currentId) ?? getNextQuestion(session);
  if (!q) return renderReview();
  currentId = q.id;
  const index = list.indexOf(q), value = session.answers[q.id];
  const field = q.type==='single'||q.type==='multi' ? `<div class="choices" role="group" aria-labelledby="question-title" aria-describedby="question-help">${q.options.map((option,i)=>`<label class="choice"><input type="${q.type==='single'?'radio':'checkbox'}" name="answer" value="${escape(option)}" ${q.type==='single'?value===option?'checked':'':Array.isArray(value)&&value.includes(option)?'checked':''}><span>${escape(option)}</span></label>`).join('')}</div>` : q.type==='textarea' ? `<textarea id="answer" class="answer-input" aria-labelledby="question-title" aria-describedby="question-help field-error" placeholder="Write in your own words…" maxlength="12000">${escape(value??'')}</textarea>` : `<input id="answer" class="answer-input" aria-labelledby="question-title" aria-describedby="question-help field-error" placeholder="Your answer…" maxlength="12000" autocomplete="off" value="${escape(value??'')}">`;
  app.innerHTML = `<div class="workspace">${rail(q.chapter,list)}<section class="question-area enter"><div class="question-meta"><p class="eyebrow">${escape(q.chapter)}</p><span>${String(index+1).padStart(2,'0')} / ${list.length} · ${q.required?'Required':'Optional'}</span></div><h1 id="question-title" tabindex="-1">${escape(q.title)}</h1><p class="help" id="question-help">${escape(q.help)}${q.type==='multi'?' Choose all that apply.':''}</p><button type="button" class="secondary ai-entry" id="ai-question">Guide me with AI ↗</button><form id="answer-form" novalidate>${field}<p class="error" id="field-error" role="alert"></p><div class="question-actions"><button type="button" class="quiet" id="back" ${index===0?'disabled':''}>← Back</button><div class="button-row">${!q.required?'<button type="button" class="quiet" id="skip">Skip for now</button>':''}<button type="submit" class="primary">${editing?'Save answer':'Continue'} →</button></div></div></form><p class="saved-note">Answers save when you continue. <button class="quiet" id="mobile-review">Review & export</button></p></section></div>`;
  app.querySelector('#ai-question').onclick = openAI;
  if (aiDialog.open) renderAI();
  app.querySelector('#answer-form').onsubmit = event => { event.preventDefault(); const value = q.type==='single'?app.querySelector('[name=answer]:checked')?.value:q.type==='multi'?[...app.querySelectorAll('[name=answer]:checked')].map(x=>x.value):app.querySelector('#answer').value; try { session = answerQuestion(session,q.id,value); persist(); advance(q.id); } catch(error) { app.querySelector('#field-error').textContent = error.message; app.querySelector('#answer')?.setAttribute('aria-invalid','true'); } };
  app.querySelector('#back').onclick = () => { currentId = list[index-1].id; renderQuestion(); };
  app.querySelector('#skip')?.addEventListener('click',()=>{try{session=skipQuestion(session,q.id);persist();advance(q.id);}catch(error){app.querySelector('#field-error').textContent=error.message;}});
  app.querySelectorAll('[data-chapter]').forEach(button=>button.onclick=()=>{currentId=list.find(q=>q.chapter===button.dataset.chapter).id;editing=false;renderQuestion();});
  app.querySelector('#review').onclick = renderReview;
  app.querySelector('#mobile-review').onclick = renderReview;
  app.querySelector('#save-json').onclick = exportSession;
  app.querySelector('#import').onclick = importFile;
  app.querySelector('#reset').onclick = reset;
  app.querySelector('#switch-mode').onclick = () => {session=validateSession({...session,mode:session.mode==='essential'?'deep':'essential'});persist();renderQuestion();};
  focusTitle();
}
function advance(previousId) { if(editing){editing=false;return renderReview();} const list=getQuestions(session), index=list.findIndex(q=>q.id===previousId); currentId=list[index+1]?.id; if(!currentId)return renderReview();renderQuestion(); }
function renderReview() {
  invalidateAI();
  if (aiDialog.open) aiDialog.close();
  screen = 'review';
  const list = getQuestions(session), chapters = [...new Set(list.map(q=>q.chapter))];
  const remaining=list.filter(q=>!answered(q)).length;
  app.innerHTML = `<section class="review enter"><div class="review-top"><div><p class="eyebrow">YOUR HERMES · SETUP REVIEW</p><h1 tabindex="-1">Make it yours.</h1><p class="help">${list.filter(answered).length} answers recorded. ${remaining} decisions remain open. This is your setup plan; nothing has been installed or connected.</p></div><button class="secondary" id="resume">Continue interview →</button></div><div class="button-row review-actions"><button class="primary" id="profile">Download profile ↓</button><button class="secondary" id="export">Download interview JSON ↓</button><button class="quiet" id="agent-review">Continue with an agent ↗</button></div>${chapters.map(chapter=>`<section class="review-group"><h2>${escape(chapter)}</h2>${list.filter(q=>q.chapter===chapter).map(q=>`<div class="review-item"><p>${escape(q.title)}</p><p class="answer">${escape(answered(q)?Array.isArray(session.answers[q.id])?session.answers[q.id].join(' · '):session.answers[q.id]:session.skipped.includes(q.id)?'Skipped — decide later':'Not yet answered')}</p><button class="quiet" data-edit="${escape(q.id)}" aria-label="Edit ${escape(q.title)}">Edit ↗</button></div>`).join('')}</section>`).join('')}<details><summary>Preview your profile</summary><pre>${escape(buildProfile(session))}</pre></details><div class="button-row"><button class="secondary" id="import">Import interview</button><button class="quiet" id="reset">Start over</button></div><p class="fine">Downloads include your answers. Keep them somewhere private. Choosing a tool or service does not grant it access.</p></section>`;
  app.querySelector('#resume').onclick=()=>{editing=false;currentId=getNextQuestion(session)?.id??list[0]?.id;renderQuestion();};
  app.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{editing=true;currentId=button.dataset.edit;renderQuestion();});
  app.querySelector('#profile').onclick=()=>download('hermes-profile.md',buildProfile(session),'text/markdown');
  app.querySelector('#export').onclick=exportSession;
  const setupButton=document.createElement('button');setupButton.className='secondary';setupButton.id='setup-json';setupButton.textContent='Download setup plan JSON ↓';setupButton.onclick=()=>download('hermes-setup-plan.json',JSON.stringify(buildSetupPlan(session),null,2),'application/json');app.querySelector('.review-actions').append(setupButton);
  app.querySelector('#profile').textContent='Download setup plan ↓';
  const plan=buildSetupPlan(session), readiness=document.createElement('section');readiness.className='review-group';readiness.innerHTML=`<h2>Before setup begins</h2><p class="help">${escape(plan.status)}</p>${plan.unresolvedRequirements.length?`<details open><summary>${plan.unresolvedRequirements.length} requirements need attention</summary><ul>${plan.unresolvedRequirements.map(item=>`<li>${escape(item.title)}${item.reason?` — ${escape(item.reason)}`:''}</li>`).join('')}</ul></details>`:'<p class="fine">Your stated requirements are recorded. An agent still needs to check service availability, compatibility and access before setup.</p>'}<details><summary>Setup verification checklist</summary><ul>${plan.checklist.map(item=>`<li>${escape(item.title)} — not verified</li>`).join('')}</ul></details>`;app.querySelector('.review-actions').after(readiness);
  app.querySelector('#agent-review').onclick=openAgent;
  app.querySelector('#import').onclick=importFile;
  app.querySelector('#reset').onclick=reset;
  focusTitle();
}
function importFile(){invalidateAI();if(aiDialog.open)aiDialog.close();document.querySelector('#import-file').click();}
document.querySelector('#import-file').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>1000000)throw new Error('Interview file exceeds 1 MB.');const incoming=validateSession(await file.text());if((Object.keys(session.answers).length || session.skipped.length) && !confirm('Replace the current interview with this file? Download your current interview first if you want to keep it.'))return;session=incoming;persist();editing=false;renderReview();notice('Interview imported. Review your answers below.');}catch(error){notice(`Import failed: ${error.message}`);}};
function reset(){invalidateAI();if(aiDialog.open)aiDialog.close();if(!confirm('Start a new interview? This replaces the saved answers in this browser.'))return;session=createSession();currentId=null;editing=false;persist();saved=false;renderLanding();}
function openAgent(){document.querySelector('#agent-dialog').showModal();}
document.querySelector('#agent-open').onclick=openAgent;
document.querySelector('[data-close]').onclick=()=>document.querySelector('#agent-dialog').close();
document.querySelector('#agent-download').onclick=exportSession;
document.querySelector('#agent-kit').onclick=async()=>{try{const response=await fetch(new URL('./START-HERE.md',import.meta.url));if(!response.ok)throw new Error('The interview guide could not be loaded.');const guide=await response.text();const kit={kind:'hermes-agent-interview-kit',version:1,instructions:'Read the guide and question catalog. Ask one active question at a time and wait for the actual user answer. Never invent answers or permissions. Preserve exact free text and listed choice values. Keep the nested session in version 2 format. When the user requests the portable result, return only the updated session object as interview.json, not this kit wrapper. This kit is not directly importable into the browser.',guide,questions,session:validateSession(session)};download('hermes-agent-kit.json',JSON.stringify(kit,null,2),'application/json');}catch(error){notice(`Agent kit could not be downloaded: ${error.message}`);}};
document.querySelector('#agent-copy').onclick=async()=>{const guide=new URL('START-HERE.md',location.href).href;const text=`Use the attached hermes-agent-kit.json to interview me for my Hermes setup. It contains the guide, questions and current session. The guide is also at ${guide}. Ask me one question at a time, wait for my actual answer, and keep a version 2 interview JSON that I can import into the browser. Use my attached session if supplied. Do not invent decisions or permissions. Produce a setup plan and identify unresolved requirements before taking any setup actions.`;try{await navigator.clipboard.writeText(text);document.querySelector('#agent-copy').textContent='Invitation copied';}catch{let area=document.querySelector('#copy-fallback');if(!area){area=document.createElement('textarea');area.id='copy-fallback';area.className='answer-input';area.setAttribute('aria-label','Invitation to copy manually');document.querySelector('#agent-dialog').append(area);}area.value=text;area.focus();area.select();notice('Clipboard unavailable. Select and copy the invitation in the dialog.');}};
// Connection credentials and question conversations deliberately live only in
// this module. They never become part of the portable interview session.
const aiDialog = document.querySelector('#ai-dialog');
const ai = { connection: null, messages: [], proposal: null, controller: null, epoch: 0, busy: false, error: '', draft: '' };
function invalidateAI() {
  ai.epoch += 1;
  ai.controller?.abort();
  ai.controller = null;
  ai.messages = [];
  ai.proposal = null;
  ai.busy = false;
  ai.error = '';
  ai.draft = '';
}
function openAI() {
  if (screen !== 'question') return;
  renderAI();
  if (!aiDialog.open) aiDialog.showModal();
}
function disconnectAI() {
  invalidateAI();
  ai.connection = null;
  renderAI();
}
aiDialog.addEventListener('close', () => { invalidateAI(); aiDialog.replaceChildren(); });
function renderAI() {
  const question = getQuestions(session).find(q => q.id === currentId);
  if (!question) return;
  const top = `<button class="dialog-close quiet" id="ai-close" aria-label="Close AI guidance">×</button><p class="eyebrow">OPTIONAL AI GUIDANCE</p><h2 id="ai-title">Talk it through.</h2>`;
  if (!ai.connection) {
    aiDialog.innerHTML = `${top}<p>This model interviews you. It does not choose or configure your Hermes model.</p><form id="ai-connect-form"><label class="ai-label" for="ai-provider">Connection type</label><select id="ai-provider"><option value="openrouter">OpenRouter</option><option value="custom">Custom OpenAI-compatible API</option></select><label class="ai-label" for="ai-endpoint">Exact chat completions URL</label><input id="ai-endpoint" type="url" value="https://openrouter.ai/api/v1/chat/completions" autocomplete="off" spellcheck="false"><label class="ai-label" for="ai-model">Interviewer model ID</label><input id="ai-model" autocomplete="off" placeholder="Enter the exact model ID" maxlength="200"><label class="ai-label" for="ai-key">API key (kept only until this page closes or you disconnect)</label><input id="ai-key" type="password" autocomplete="off" maxlength="4096"><p class="fine">Use a browser-compatible chat API with CORS support. Native Anthropic endpoints are not supported. For local services, use localhost or 127.0.0.1. Browser or mixed-content restrictions can still block them; do not disable browser security.</p><p class="ai-destination">Destination: <span id="ai-destination"></span></p><label class="choice ai-consent"><input id="ai-consent" type="checkbox"><span>I agree to send this question, its saved answer and its chat directly to this destination when I send a message. The provider can see them and may charge me.</span></label><p class="error" id="ai-error" role="alert"></p><button class="primary" type="submit" id="ai-connect">Connect</button><p class="fine">Connecting sends nothing. No key or chat is saved to browser storage or included in downloads.</p></form>`;
    const endpoint = aiDialog.querySelector('#ai-endpoint');
    const updateDestination = () => { aiDialog.querySelector('#ai-destination').textContent = endpoint.value || 'Enter a destination'; aiDialog.querySelector('#ai-consent').checked = false; };
    updateDestination();
    endpoint.oninput = updateDestination;
    aiDialog.querySelector('#ai-model').oninput = updateDestination;
    aiDialog.querySelector('#ai-key').oninput = updateDestination;
    aiDialog.querySelector('#ai-provider').onchange = event => { endpoint.value = event.target.value === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : ''; updateDestination(); };
    aiDialog.querySelector('#ai-connect-form').onsubmit = event => {
      event.preventDefault();
      const error = aiDialog.querySelector('#ai-error');
      if (!aiDialog.querySelector('#ai-consent').checked) { error.textContent = 'Please agree to the destination and data sharing before connecting.'; return; }
      try {
        const connection = validateConnection({ endpoint: endpoint.value, model: aiDialog.querySelector('#ai-model').value, apiKey: aiDialog.querySelector('#ai-key').value });
        invalidateAI();
        ai.connection = connection;
        renderAI();
      } catch (problem) { error.textContent = problem.message; }
    };
  } else {
    aiDialog.innerHTML = `${top}<p class="ai-current" id="ai-current">${escape(question.title)}</p><p class="fine">Interviewer: ${escape(ai.connection.model)}<br>Destination: ${escape(ai.connection.endpoint)}<br>Only this question, its saved answer and this chat are shared when you send.</p><div class="button-row"><button class="quiet" id="ai-disconnect">Disconnect / change connection</button><button class="quiet" id="ai-clear">Clear this chat</button></div><div class="ai-messages" role="log" aria-label="Question discussion" aria-live="polite">${ai.messages.map(message => `<section class="ai-message"><strong>${message.role === 'user' ? 'You' : 'Interviewer'}</strong><p>${escape(message.content)}</p></section>`).join('')}</div>${ai.proposal !== null ? `<section class="ai-proposal"><h3>Suggested answer</h3><p>${escape(Array.isArray(ai.proposal) ? ai.proposal.join(' · ') : ai.proposal)}</p><div class="button-row"><button class="primary" id="ai-accept">Use this answer</button><button class="quiet" id="ai-dismiss">Dismiss suggestion</button></div></section>` : ''}<form id="ai-chat-form"><label class="ai-label" for="ai-message">Discuss this question</label><textarea id="ai-message" maxlength="4000" rows="3" placeholder="Ask for an explanation, or describe what you need." ${ai.busy ? 'disabled' : ''}>${escape(ai.draft)}</textarea><p class="error" id="ai-error" role="alert">${escape(ai.error)}</p><div class="button-row"><button class="primary" id="ai-send" type="submit" ${ai.busy ? 'disabled' : ''}>${ai.busy ? 'Waiting for interviewer…' : 'Send message'}</button>${ai.busy ? '<button class="secondary" id="ai-cancel" type="button">Cancel request</button>' : ''}</div><p class="fine">Enter adds a new line. Long interviewer replies are shortened to 4,000 characters when sent as context. A suggestion is saved only when you choose “Use this answer”. Closing clears this question’s chat.</p></form>`;
    aiDialog.querySelector('#ai-disconnect').onclick = disconnectAI;
    aiDialog.querySelector('#ai-clear').onclick = () => { invalidateAI(); renderAI(); };
    aiDialog.querySelector('#ai-chat-form').onsubmit = sendAI;
    aiDialog.querySelector('#ai-message').oninput = event => { ai.draft = event.target.value; };
    aiDialog.querySelector('#ai-cancel')?.addEventListener('click', () => { const draft = ai.draft; invalidateAI(); ai.draft = draft; ai.error = 'Request cancelled. Send a message when you are ready.'; renderAI(); });
    aiDialog.querySelector('#ai-dismiss')?.addEventListener('click', () => { ai.proposal = null; renderAI(); });
    aiDialog.querySelector('#ai-accept')?.addEventListener('click', () => {
      try {
        session = answerQuestion(session, question.id, ai.proposal);
        persist();
        editing = false;
        advance(question.id);
      } catch (problem) { ai.proposal = null; ai.error = problem.message; renderAI(); }
    });
  }
  aiDialog.querySelector('#ai-close').onclick = () => aiDialog.close();
}
async function sendAI(event) {
  event.preventDefault();
  if (ai.busy || !ai.connection) return;
  const content = aiDialog.querySelector('#ai-message').value.trim();
  if (!content) { aiDialog.querySelector('#ai-error').textContent = 'Write a message first.'; return; }
  if (ai.messages.length >= 18) { ai.error = 'This conversation is full. Clear this chat to continue.'; renderAI(); return; }
  const question = getQuestions(session).find(q => q.id === currentId);
  if (!question) return;
  const epoch = ai.epoch, questionId = currentId;
  ai.draft = content;
  const priorMessages = ai.messages;
  ai.messages = [...ai.messages, { role: 'user', content }];
  ai.proposal = null;
  ai.error = '';
  ai.busy = true;
  ai.controller = new AbortController();
  renderAI();
  try {
    const result = await requestGuidance({ ...ai.connection, question, currentAnswer: session.answers[question.id] ?? null, messages: ai.messages.map(message => ({ ...message, content: message.content.slice(0, 4000) })), signal: ai.controller.signal });
    if (epoch !== ai.epoch || currentId !== questionId || !aiDialog.open) return;
    ai.draft = '';
    ai.messages = [...ai.messages, { role: 'assistant', content: result.reply }];
    if (result.proposal !== null) {
      try { answerQuestion(session, question.id, result.proposal); ai.proposal = result.proposal; }
      catch { ai.error = 'The suggested answer does not match this question. Ask the interviewer to try again, or answer in the wizard.'; }
    }
  } catch (problem) {
    if (epoch !== ai.epoch || currentId !== questionId || !aiDialog.open) return;
    ai.messages = priorMessages;
    ai.error = problem.message;
  } finally {
    if (epoch === ai.epoch && currentId === questionId && aiDialog.open) {
      ai.busy = false;
      ai.controller = null;
      renderAI();
      aiDialog.querySelector('#ai-message')?.focus();
    }
  }
}
renderLanding();
