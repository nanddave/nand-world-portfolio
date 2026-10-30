import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { STOPS, PROJECTS } from '../src/content/stops.js';
const task=process.argv[2] || 'A02';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:browserPath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const errors=[];mkdirSync('shots',{recursive:true});
async function pageAt(query='',width=390,height=844,options={}) {
 const p=await browser.newPage({viewport:{width,height},...options});p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://**/*',r=>r.abort());await p.goto(origin+'/'+query);await p.waitForFunction(()=>window.__app);return p;
}
try {
 if(task==='A02') {
  for(const [w,h] of [[360,640],[390,844],[390,664],[768,1024],[1440,900],[720,450]]) {
   const p=await pageAt('?role=recruiter',w,h);
   for(const id of ['quick','talk','build','pass','skills','how']) {
    await p.evaluate(id=>window.__app.openModal('#'+id),id);
    assert.ok(await p.locator('#'+id+' .sheet').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=15&&r.top>=15&&r.right<=innerWidth-15&&r.bottom<=innerHeight-15&&el.scrollWidth<=el.clientWidth+1}),`${id} ${w}`);
    await p.locator('#'+id+' .sheet').evaluate(el=>el.scrollTop=el.scrollHeight);
    const close=p.locator('#'+id+' [data-close]').first();await close.scrollIntoViewIfNeeded(); assert.ok(await close.isVisible());
   }
   await p.evaluate(()=>window.__app.openModal('#talk'));await p.locator('#talkMail').evaluate(el=>el.textContent='Email '+('long-email-'.repeat(15))+'@example.com');
   assert.ok(await p.locator('#talk .sheet').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await p.screenshot({path:`shots/A02-${w}x${h}.png`});await p.close();
  }
  const p=await pageAt('',390,844);
  await p.evaluate(async()=>{await window.__app.enterCity(0);window.__app.focusSpot(0)});
  await p.locator('#card.open').waitFor();
  await p.waitForFunction(()=>Math.abs(document.querySelector('#card').getBoundingClientRect().bottom-innerHeight)<1);
  const bounds=await p.locator('#card').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}});
  assert.ok(bounds.left>=0&&bounds.right<=bounds.viewportWidth&&bounds.bottom<=bounds.viewportHeight+1&&bounds.height<=bounds.viewportHeight*.72+1&&bounds.scrollWidth<=bounds.clientWidth+1,`phone story bounds: ${JSON.stringify(bounds)}`);
  await p.locator('#card').evaluate(el=>el.scrollTop=el.scrollHeight);
  await p.locator('#kNext').scrollIntoViewIfNeeded();
  assert.ok(await p.locator('#kNext').isVisible(),'story final action visible');
  await p.locator('#cardX').scrollIntoViewIfNeeded();
  assert.ok(await p.locator('#cardX').isVisible(),'story close visible');
  await p.screenshot({path:'shots/A02-story-mobile.png'});await p.close();
 } else if(task==='A03') {
  for (const role of ['recruiter','founder']) { const p=await pageAt('?role='+role); assert.ok(await p.locator('.modal:not([hidden])').isVisible()); await p.close(); }
  const p=await pageAt('',1440,900);
  await p.evaluate(async()=>await window.__app.enterCity(0));
  await p.locator('#driveBtn').click();
  await p.keyboard.down('w');await p.waitForFunction(()=>window.__app.drive.speed>1);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.evaluate(()=>window.__app.drive.speed),0);assert.equal(await p.evaluate(()=>window.__app.drive.input.throttle),0);await p.keyboard.up('w');
  await p.keyboard.down('w');
  await p.waitForFunction(()=>window.__app.drive.speed>1);
  await p.locator('#menuBtn').click();await p.locator('#skillsBtn').click();
  const before=await p.evaluate(()=>({x:window.__app.drive.x,z:window.__app.drive.z,speed:window.__app.drive.speed,input:{...window.__app.drive.input}}));
  await p.waitForTimeout(500);
  const after=await p.evaluate(()=>({x:window.__app.drive.x,z:window.__app.drive.z,speed:window.__app.drive.speed,input:{...window.__app.drive.input}}));
  assert.deepEqual(after,before);assert.equal(after.speed,0);assert.deepEqual(after.input,{throttle:0,steer:0,brake:false});
  await p.keyboard.up('w');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>window.__app.drive.active),true);
  await p.evaluate(()=>{const el=document.querySelector('#joy');el.setPointerCapture=()=>{};el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,clientX:100,clientY:30,bubbles:true}));el.dispatchEvent(new PointerEvent('pointercancel',{pointerId:9,bubbles:true}));});
  assert.deepEqual(await p.evaluate(()=>({...window.__app.drive.input})),{throttle:0,steer:0,brake:false});
  await p.evaluate(()=>window.__app.focusSpot(0));assert.equal(await p.evaluate(()=>document.activeElement.id),'cardX');
  await p.locator('#menuBtn').click();await p.locator('#skillsBtn').click();await p.keyboard.press('Escape');assert.ok(await p.locator('#card.open').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'menuBtn');
  await p.keyboard.press('Escape');assert.equal(await p.locator('#card.open').count(),0);
  await p.locator('#askIn').focus();await p.keyboard.type('w');assert.equal(await p.locator('#askIn').inputValue(),'w');assert.equal(await p.evaluate(()=>window.__app.drive.input.throttle),0);
  await p.close();
 } else if(task==='audit-completion') {
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],speak:u=>setTimeout(()=>u.onend?.(),10),cancel(){},speaking:false}})});await p.route('https://**/*',r=>r.abort());await p.goto(origin+'/');await p.waitForFunction(()=>window.__app);
  const actions={machine:['[data-act="fold"]','[data-act="realign"]'],train:['[data-mlp]','[data-train]'],etl:['[data-run]'],pii:['[data-scan]'],agents:['[data-run]'],goal:['[data-plan]'],jarvis:['[data-send]'],voice:['[data-play]'],lot:['[data-raise]']};
  let previousCity=-1, completed=0;for(const [id,steps] of Object.entries(actions)) {const ci=STOPS.findIndex(s=>s.spots.some(sp=>sp.mission===id)), k=STOPS[ci].spots.findIndex(sp=>sp.mission===id);if(ci!==previousCity){if(previousCity>=0) await p.evaluate(()=>window.__app.exitCity());await p.evaluate(ci=>window.__app.enterCity(ci),ci);previousCity=ci;}await p.evaluate(k=>window.__app.focusSpot(k),k);await p.locator(`#kMission ${steps[0]}`).waitFor();for(const selector of steps) await p.locator(`#kMission ${selector}`).click();completed++;await p.waitForFunction(n=>window.__app.state.missions.size===n,completed,{timeout:30000});assert.ok((await p.locator('#passBtn').getAttribute('aria-label')).includes(`Missions ${completed}/9`));await p.locator('#cardX').click();}assert.equal(await p.locator('#passN').innerText(),'6/7');await p.close();
 } else if(task==='audit-access') {
  const p=await pageAt('',390,844,{reducedMotion:'reduce'});await p.evaluate(async()=>window.__app.enterCity(1));assert.ok(await p.locator('#ctitle.compact #cCredit').isVisible(),'map attribution remains visible');assert.ok((await p.locator('#cCredit').innerText()).includes('OpenStreetMap'));await p.locator('#placesBtn').click();assert.ok((await p.locator('#placesList').innerText()).includes('interactive demo'));await p.keyboard.press('Escape');await p.locator('#menuBtn').click();await p.locator('#copilotBtn').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'askIn');assert.equal(await p.locator('#pilotMin').getAttribute('aria-expanded'),'true');await p.close();
  const q=await pageAt('',1440,900,{reducedMotion:'reduce'});await q.evaluate(async()=>window.__app.enterCity(0));await q.waitForFunction(()=>document.querySelector('.spot:not(.off)'));const marker=q.locator('.spot:not(.off)').first(), index=await marker.getAttribute('data-spot');await marker.focus();await q.evaluate(()=>window.__app.city.focus(0));await q.waitForFunction(i=>document.querySelector(`.spot[data-spot="${i}"]`).classList.contains('off'),index);assert.equal(await q.evaluate(()=>document.activeElement.id),'placesBtn','focus moves to visible Places control');await q.close();
 } else if(task==='audit-motion') {
  const p=await pageAt('',1440,900);await p.evaluate(async()=>window.__app.enterCity(1));await p.evaluate(()=>{const c=window.__app.city.C, update=c.update.bind(c);window.__ticks=0;c.update=(...args)=>{window.__ticks++;return update(...args)}});await p.locator('#menuBtn').click();await p.locator('#motionBtn').click();assert.equal(await p.locator('#motionBtn').getAttribute('aria-pressed'),'true');const paused=await p.evaluate(()=>window.__ticks);await p.waitForTimeout(700);assert.equal(await p.evaluate(()=>window.__ticks),paused,'scene remains paused');await p.locator('#motionBtn').click();await p.waitForFunction(()=>window.__ticks>0);assert.equal(await p.locator('#motionBtn').getAttribute('aria-pressed'),'false');await p.close();
 } else if(task==='audit-navigation') {
  const p=await pageAt('',1440,900);await p.locator('#startBtn').click();await p.locator('#stops .stopb').nth(4).click();await p.waitForFunction(()=>window.__app.state.mode==='city'&&window.__app.state.cityIdx===4);await p.waitForTimeout(4000);assert.equal(await p.locator('#daycap.show').count(),0,'interrupted introduction clears its caption');assert.equal(await p.locator('#travel.show').count(),0,'city selection clears travel caption');await p.close();
  const q=await pageAt('?role=recruiter',1440,900);await q.locator('#quick [data-go]').first().click();await q.waitForFunction(()=>window.__app.state.mode==='city'&&window.__app.state.cityIdx===4);await q.locator('#placesBtn').click();await q.locator('#placesList button').nth(3).click();await q.waitForTimeout(1800);assert.equal(await q.evaluate(()=>window.__app.state.spot),3,'a delayed selection cannot reopen an older story');await q.close();
  const r=await pageAt('?stop=nadiad',1440,900);await r.waitForFunction(()=>window.__app.state.mode==='city');await r.evaluate(()=>{const load=window.__app.city.load.bind(window.__app.city);window.__app.city.load=async i=>{if(i===6) await new Promise(resolve=>setTimeout(resolve,1500));return load(i)}});await r.locator('#stops .stopb').nth(6).click();await r.locator('#home').click();await r.waitForTimeout(2000);assert.equal(await r.evaluate(()=>window.__app.state.mode),'intro');assert.equal(await r.locator('body.incity').count(),0);assert.equal(new URL(r.url()).searchParams.has('stop'),false);await r.close();
 } else if(task==='B07') {
  const actions={machine:'[data-act]',train:'[data-train]',etl:'[data-run]',pii:'[data-scan]',agents:'[data-run]',goal:'[data-plan]',jarvis:'[data-send]',voice:'[data-play]',lot:'[data-raise]'};
  for(const [id,selector] of Object.entries(actions)) {
   const ci=STOPS.findIndex(s=>s.spots.some(sp=>sp.mission===id)), k=STOPS[ci].spots.findIndex(sp=>sp.mission===id), p=await pageAt('',390,844,{reducedMotion:'reduce'});
   assert.equal(await p.locator('#passN').innerText(),'0/7');await p.evaluate(async ci=>window.__app.enterCity(ci),ci);await p.evaluate(k=>window.__app.focusSpot(k),k);await p.locator(`#kMission ${selector}`).first().waitFor();
   const initial=await p.locator('#workN').innerText();if(id==='train') await p.locator('#kMission [data-ex="blobs"]').click();
   if(id==='voice') await p.locator('#kMission [data-mute]').check();
   await p.locator(`#kMission ${selector}`).first().click();await p.locator('#cardX').click();const completed=await p.evaluate(()=>window.__app.state.missions.size);const other=k===0?1:0;await p.evaluate(other=>window.__app.focusSpot(other),other);await p.waitForTimeout(2000);assert.equal(await p.evaluate(()=>window.__app.state.missions.size),completed,`${id} late completion`);assert.equal(await p.locator('#kTitle').innerText(),STOPS[ci].spots[other].t,`${id} did not replace the next story`);
   await p.evaluate(k=>window.__app.focusSpot(k),k);await p.locator(`#kMission ${selector}`).first().waitFor();assert.equal(await p.locator('#workN').innerText(),initial,`${id} fresh work log`);assert.ok((await p.locator('#passBtn').getAttribute('aria-label')).includes('Missions '+completed+'/9'));await p.close();
  }
 } else if(task==='B06') {
  for(const [query,heading] of [['','What should we build next?'],['?for=%3Cscript%3E%E6%9D%B1%E4%BA%AC%20%26%20Co%3C%2Fscript%3E'+encodeURIComponent('x'.repeat(50)),'What could we build at']]) {
   const p=await pageAt(query,390,844,{reducedMotion:'reduce'});assert.equal(await p.locator('#passN').innerText(),'0/7');await p.evaluate(async()=>window.__app.enterCity(6));await p.evaluate(()=>window.__app.focusSpot(2));await p.locator('#kMission [data-raise]').waitFor();assert.ok((await p.locator('#kMission h4').innerText()).includes(heading));assert.equal(await p.locator('#kMission a[href^="mailto:"]').count(),1);assert.equal(await p.locator('#kMission script').count(),0);if(!query) await p.locator('#ms-lot-name').fill('<script>東京 & Co</script>');await p.locator('#kMission [data-raise]').click();assert.ok(await p.evaluate(()=>window.__app.city.C.lotBlocks.every(b=>b.visible&&b.scale.y===1)));assert.equal(await p.evaluate(()=>window.__app.state.missions.size),1);assert.equal(await p.locator('#passN').innerText(),'1/7');assert.ok(!(await p.locator('#kMission').innerText()).includes('What AI handles'));await p.screenshot({path:`shots/B06-${query?'company':'generic'}.png`});await p.close();
  }
 } else if(task==='B05') {
  const p=await pageAt('',390,844,{reducedMotion:'reduce'});await p.locator('#menuBtn').click();await p.locator('#skillsBtn').click();assert.equal(await p.locator('#skillProjects [data-project]').count(),3);assert.equal(await p.locator('#skillPapers a').count(),2);assert.ok((await p.locator('#skillList').innerText()).includes('Try an illustration'));await p.screenshot({path:'shots/B05-skills.png'});await p.locator('#skillProjects [data-project="hapi"]').click();assert.equal(await p.locator('#projectT').innerText(),'Hapi');assert.ok((await p.locator('#projectBody').innerText()).includes('I designed and built Hapi'));await p.keyboard.press('Escape');await p.locator('#menuBtn').click();await p.locator('#howBtn').click();const how=await p.locator('#how').innerText();assert.ok(how.includes('Vite builds'));assert.ok(how.includes('private'));assert.ok(!how.includes('No APIs'));await p.close();
  const cv=await browser.newPage();await cv.goto(origin+'/cv.html');const body=await cv.locator('body').innerText();for(const text of ['six kinds of planted contradictions','NeurIPS 2025 GenProCC Workshop','13 locales','I am a co-author','simple rule-based illustration']) assert.ok(body.includes(text),text);await cv.close();
 } else if(task==='B04') {
  const direct=await pageAt('?project=hapi&role=recruiter',390,844,{reducedMotion:'reduce'});assert.ok(await direct.locator('#project').isVisible());assert.equal(await direct.locator('.modal:not([hidden])').count(),1);await direct.locator('#project [data-close]').click();await direct.locator('#quick').waitFor({state:'visible'});assert.equal(new URL(direct.url()).searchParams.has('project'),false);await direct.close();
  const founder=await pageAt('?role=founder');assert.ok(await founder.locator('#buildLinkedin').isVisible());assert.ok(await founder.locator('#buildResume').isVisible());assert.ok((await founder.locator('#callBtn').getAttribute('href')).startsWith('https://cal.com/'));await founder.close();
  const bad=await pageAt('?project=%3Cscript%3E&role=recruiter');assert.ok(await bad.locator('#quick').isVisible());assert.equal(await bad.locator('#project').isVisible(),false);await bad.close();
  const invalid=await pageAt('?stop=sf&spot=999',390,844,{reducedMotion:'reduce'});await invalid.waitForFunction(()=>window.__app.state.mode==='city');assert.equal(await invalid.evaluate(()=>window.__app.state.spot),-1);await invalid.close();
  const p=await pageAt('?role=recruiter',1440,900,{reducedMotion:'reduce'});await p.keyboard.press('Escape');const initial=await p.evaluate(()=>history.length);await p.locator('#menuBtn').click();await p.locator('#projectsBtn').click();await p.locator('#projectsList [data-project="hapi"]').click();assert.equal(await p.evaluate(()=>history.length),initial+1);assert.equal(new URL(p.url()).searchParams.get('project'),'hapi');await p.goBack();await p.locator('#quick').waitFor({state:'visible'});await p.goForward();await p.locator('#project').waitFor({state:'visible'});assert.equal(await p.locator('#projectT').innerText(),'Hapi');await p.keyboard.press('Escape');await p.locator('#quick').waitFor({state:'visible'});assert.equal(new URL(p.url()).searchParams.has('project'),false);await p.close();
  const searchPage=await pageAt('',1440,900,{reducedMotion:'reduce'});await searchPage.evaluate(async()=>window.__app.enterCity(0));await searchPage.locator('#askIn').fill('Tell me about Hapi');await searchPage.locator('#ask').evaluate(el=>el.requestSubmit());await searchPage.locator('#project').waitFor({state:'visible'});assert.equal(await searchPage.locator('#projectT').innerText(),'Hapi');await searchPage.close();
 } else if(task==='B03') {
  for(const [w,h] of [[390,844],[1440,900]]) {const p=await pageAt('',w,h,{reducedMotion:'reduce'});for(const item of PROJECTS) {await p.locator('#menuBtn').click();await p.locator('#projectsBtn').click();await p.locator(`#projectsList [data-project="${item.id}"]`).click();assert.equal(await p.locator('#projectT').innerText(),item.name);assert.ok((await p.locator('#projectBody').innerText()).includes(item.evidenceNote));assert.equal(await p.locator('#projectVisit').isVisible(),true);assert.equal(await p.evaluate(()=>document.activeElement.closest('.modal')?.id),'project');const r=await p.locator('#project .sheet').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=w&&r.y>=0&&r.y+r.height<=h);if(item.id==='hapi') await p.screenshot({path:`shots/B03-${w}.png`});await p.locator('#projectVisit').click();await p.waitForFunction(()=>window.__app.state.mode==='city'&&window.__app.state.spot>=0);const spot=await p.evaluate(()=>[window.__app.state.cityIdx,window.__app.state.spot]);const ci=STOPS.findIndex(s=>s.id===item.where[0]);assert.deepEqual(spot,[ci,STOPS[ci].spots.findIndex(s=>s.t===item.where[1])]);await p.locator('#cardX').click();}await p.close();}
 } else if(task==='B02') {
  assert.deepEqual(PROJECTS.map(p=>p.id),['jarvis','hapi','salon']);assert.equal(new Set(PROJECTS.map(p=>p.id)).size,PROJECTS.length);
  for(const project of PROJECTS) {assert.ok(project.status&&project.contribution&&project.evidenceNote&&project.flow.length&&project.limitations.length);assert.ok(STOPS.find(s=>s.id===project.where[0])?.spots.some(s=>s.t===project.where[1]),project.id);}
  const p=await pageAt('');const cv=await browser.newPage();await cv.goto(origin+'/cv.html');
  for(const project of PROJECTS) {const selector='#project-'+project.id;assert.equal(await p.locator(selector).count(),1);assert.equal(await cv.locator(selector).count(),1);assert.equal(await p.locator(selector).textContent(),await cv.locator(selector).textContent());}
  await cv.close();await p.close();
 } else if(task==='B01') {
  const protectedBullet='Rebuilt ETL pipelines in PySpark across 10+ sources, improving data accuracy 18% and cutting KPI runtimes 23.7%; automated unsupervised clustering of 1,000+ promotional offers at 98.2% accuracy, saving 1,000+ manual hours a year.';assert.ok(STOPS.find(s=>s.id==='irving').spots[0].b.includes(protectedBullet));
  const chapters=[[1,1,'misaligned during folding'],[2,1,'started running my own life'],[4,0,'three AI teams'],[5,1,'24 hours inside its building']];
  for(const [ci,k,phrase] of chapters) {const p=await pageAt('',390,844,{reducedMotion:'reduce'});await p.evaluate(async ci=>window.__app.enterCity(ci),ci);await p.evaluate(k=>window.__app.focusSpot(k),k);await p.locator('#card.open').waitFor();assert.ok((await p.locator('#kBody').innerText()).includes(phrase));await p.screenshot({path:`shots/B01-${ci}.png`});await p.close();}
  const p=await browser.newPage();await p.goto(origin+'/cv.html');const cv=await p.locator('body').innerText();for(const phrase of ['misaligned during folding','started running my own life','three AI teams','24 hours inside its building',protectedBullet,'LegalWiz','Scalable Multilingual PII']) assert.ok(cv.includes(phrase),phrase);assert.ok(!cv.includes('Your story:'));await p.close();
 } else if(task==='A08') {
  const labels={machine:'Interactive reconstruction',train:'A small model trains',etl:'Browser demonstration',pii:'Rule-based illustration',agents:'Deterministic illustration',goal:'Illustrative breakdown',jarvis:'rules and mock',voice:'fictional calendar',lot:'not a company assessment'};
  for(const [id,phrase] of Object.entries(labels)) {
   const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.route('https://**/*',r=>r.abort());await p.goto(`${origin}/mission.html?m=${id}`);await p.waitForFunction(()=>window.__ready);
   const note=p.locator('#m .mission-scope');assert.equal(await note.count(),1);assert.ok((await note.innerText()).includes(phrase));
   assert.ok(await p.evaluate(()=>{const note=document.querySelector('#m .mission-scope'), control=document.querySelector('#m button,#m input,#m textarea,#m select');return note&&control&&!!(note.compareDocumentPosition(control)&Node.DOCUMENT_POSITION_FOLLOWING)}),`${id} disclosure precedes controls`);
   if(id==='jarvis') await p.screenshot({path:'shots/A08-jarvis.png'});await p.close();
  }
 } else if(task==='A06') {
  const p=await pageAt('',1440,900,{reducedMotion:'reduce'});
  await p.evaluate(async()=>window.__app.enterCity(0));assert.ok(await p.locator('#ctitle.compact').isVisible());assert.equal(await p.evaluate(()=>document.body.classList.contains('live-mood')),false);
  await p.evaluate(async()=>{await window.__app.city.load(3);const load=window.__app.city.load;window.__app.city.load=async i=>{if(i===6) await new Promise(r=>setTimeout(r,1200));return load(i)};});
  const started=Date.now();await p.evaluate(()=>{const b=document.querySelectorAll('#stops .stopb');b[6].click();b[3].click()});
  await p.waitForFunction(()=>window.__app.state.mode==='city'&&window.__app.state.cityIdx===3);assert.ok(Date.now()-started<2000,'cached city selection under 2 seconds');await p.waitForTimeout(1500);assert.equal(await p.evaluate(()=>window.__app.state.cityIdx),3);
  assert.equal(await p.evaluate(()=>window.__app.state.transit),false);await p.close();
  const normal=await pageAt('',1440,900);await normal.evaluate(async()=>window.__app.enterCity(0));await normal.locator('#driveBtn').focus();await normal.waitForTimeout(2700);assert.equal(await normal.locator('#ctitle').evaluate(el=>el.classList.contains('compact')),false);await normal.locator('#menuBtn').focus();await normal.waitForFunction(()=>document.querySelector('#ctitle').classList.contains('compact'));assert.equal(await normal.locator('#cScene').textContent(),'Designed scene');await normal.screenshot({path:'shots/A06-city-desktop.png'});await normal.waitForFunction(()=>document.querySelector('#pilot').classList.contains('min'),null,{timeout:10000});await normal.locator('#pilotMin').click();await normal.waitForTimeout(8200);assert.equal(await normal.locator('#pilot').evaluate(el=>el.classList.contains('min')),false);await normal.close();
  const intro=await pageAt('',1440,900);await intro.locator('#startBtn').click();await intro.locator('#stops .stopb').nth(4).click();await intro.waitForFunction(()=>window.__app.state.mode==='city'&&window.__app.state.cityIdx===4);await intro.waitForTimeout(3500);assert.equal(await intro.evaluate(()=>window.__app.state.cityIdx),4);await intro.close();
  const recruiter=await pageAt('?role=recruiter',390,844,{reducedMotion:'reduce'});await recruiter.locator('#quick [data-go]').first().click();await recruiter.waitForFunction(()=>window.__app.state.mode==='city'&&window.__app.state.cityIdx===4&&window.__app.state.spot>=0);await recruiter.screenshot({path:'shots/A06-city-mobile.png'});await recruiter.close();
 } else if(task==='A05') {
  for(const [w,h] of [[390,844],[1440,900]]) {
   const p=await pageAt('',w,h,{reducedMotion:'reduce'});
   for(let i=0;i<7;i++) {
    if(i) await p.evaluate(()=>window.__app.exitCity());
    await p.evaluate(i=>window.__app.enterCity(i),i);await p.waitForTimeout(1200);
    const capture=()=>p.evaluate(()=>{const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&+getComputedStyle(el).opacity>0;const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}};return {labels:[...document.querySelectorAll('.spot:not(.off) .lab:not(.collapsed)')].map(rect),reserved:['#top','#ctitle','#bar','#pilot','#joy','#hornBtn'].map(s=>document.querySelector(s)).filter(visible).map(rect),spots:window.__app.city.C.spots.length};});
    const check=info=>{for(const [j,a] of info.labels.entries()) {assert.ok(a.left>=7&&a.top>=7&&a.right<=w-7&&a.bottom<=h-7,`city ${i} label bounds`);for(const b of [...info.reserved,...info.labels.slice(j+1)]) assert.ok(a.right+7<=b.left||a.left-7>=b.right||a.bottom+7<=b.top||a.top-7>=b.bottom,`city ${i} label overlap ${JSON.stringify({a,b})}`);}if(w<768) assert.ok(info.labels.length<=1);};
    const info=await capture();check(info);await p.evaluate(()=>window.__app.city.drag(240,50));await p.waitForTimeout(350);check(await capture());
    for(let k=0;k<info.spots;k++) {await p.locator('#placesBtn').click();assert.equal(await p.locator('#placesList button').count(),info.spots);await p.locator('#placesList button').nth(k).click();assert.equal(await p.evaluate(()=>window.__app.state.spot),k);assert.equal(await p.evaluate(()=>document.activeElement.id),'cardX');await p.locator('#cardX').click();}
    await p.screenshot({path:`shots/A05-${i}-${w}.png`});
   }
   await p.close();
  }
 } else if(task==='A04') {
  const p=await pageAt('',390,844,{reducedMotion:'reduce'});
  assert.equal(await p.locator('#intro .row button').count(),2);
  assert.equal(await p.locator('#soundBtn').getAttribute('aria-pressed'),'false');
  await p.screenshot({path:'shots/A04-hero-mobile.png'});
  await p.locator('#menuBtn').click();
  for(const id of ['cvLink','quickBtn','skillsBtn','howBtn','trailerBtn']) assert.ok(await p.locator('#'+id).isVisible(),id);
  await p.locator('#cvLink').click();assert.ok(await p.locator('#readable').isVisible());await p.locator('#returnWorld').click();await p.locator('#menuBtn').click();
  for(const [button,modal] of [['quickBtn','quick'],['skillsBtn','skills'],['howBtn','how']]) { await p.locator('#'+button).click();assert.ok(await p.locator('#'+modal).isVisible());await p.keyboard.press('Escape');await p.locator('#menuBtn').click(); }
  assert.equal(await p.locator('#menu').getByText('Projects',{exact:true}).count(),1);
  await p.locator('#trailerBtn').click();await p.waitForFunction(()=>document.body.classList.contains('trailer'));assert.equal(await p.locator('#soundBtn').getAttribute('aria-pressed'),'false');
  await p.keyboard.press('Escape');assert.equal(await p.locator('#soundBtn').getAttribute('aria-pressed'),'false');
  await p.locator('#startBtn').click();assert.equal(await p.locator('#soundBtn').getAttribute('aria-pressed'),'false');
  await p.screenshot({path:'shots/A04-mobile.png'});await p.close();
  const desktop=await pageAt('',1440,900);await desktop.screenshot({path:'shots/A04-hero-desktop.png'});await desktop.locator('#soundBtn').click();await desktop.locator('#menuBtn').click();await desktop.locator('#trailerBtn').click();await desktop.waitForFunction(()=>document.body.classList.contains('trailer'));await desktop.keyboard.press('Escape');assert.equal(await desktop.locator('#soundBtn').getAttribute('aria-pressed'),'true');await desktop.close();
  const noMic=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});noMic.on('pageerror',e=>errors.push(e.message));await noMic.addInitScript(()=>{Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined,configurable:true});});await noMic.route('https://**/*',r=>r.abort());await noMic.goto(origin+'/');await noMic.waitForFunction(()=>window.__app);assert.equal(await noMic.locator('#micBtn').count(),0);await noMic.locator('#startBtn').click();await noMic.waitForFunction(()=>window.__app.state.mode==='city');await noMic.locator('#askIn').fill('voice AI');await noMic.locator('#ask').evaluate(el=>el.requestSubmit());await noMic.waitForFunction(()=>/Best match|salon/.test(document.querySelector('#pilotText').textContent));await noMic.close();
  const denied=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});denied.on('pageerror',e=>errors.push(e.message));await denied.addInitScript(()=>{window.__speechStarts=0;window.SpeechRecognition=class {start(){window.__speechStarts++;setTimeout(()=>{this.onerror?.({error:'not-allowed'});this.onend?.()},0)}stop(){}};});await denied.route('https://**/*',r=>r.abort());await denied.goto(origin+'/');await denied.waitForFunction(()=>window.__app);await denied.locator('#startBtn').click();await denied.waitForFunction(()=>window.__app.state.mode==='city');assert.equal(await denied.evaluate(()=>window.__speechStarts),0);await denied.locator('#micBtn').click();await denied.waitForFunction(()=>document.querySelector('#pilotText').textContent.includes('mic is blocked'));assert.equal(await denied.evaluate(()=>window.__speechStarts),1);await denied.close();
 }
 assert.deepEqual(errors,[]);console.log(task+' assertions passed');
} finally {await browser.close();await server.close();}
