import assert from 'node:assert/strict';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';

const dir=await mkdtemp(join(tmpdir(),'nand-world-'));
await copyFile('dist-single/index.html',join(dir,'index.html'));
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const browser=await chromium.launch({executablePath:browserPath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const hosted=`http://127.0.0.1:${server.httpServer.address().port}/`;
const standalone=pathToFileURL(join(dir,'index.html')).href;
try {
 for(const url of [hosted,standalone]) for(const mode of ['nojs','nogl']) {
  const ctx=await browser.newContext({javaScriptEnabled:mode!=='nojs'}), p=await ctx.newPage();
  await p.route('https://**/*',r=>r.abort());
  if(mode==='nogl') await p.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'||type==='experimental-webgl'?null:get.call(this,type,...args)};});
  await p.goto(url+(mode==='nogl'?'?project=hapi':''));await p.locator('#readable').waitFor({state:'visible'});
  assert.ok((await p.locator('#readable').innerText()).includes('Nand Dave'));
  assert.ok(await p.locator('#readable a[href^="mailto:"]').isVisible());
  if(mode==='nogl') { await p.waitForFunction(()=>document.querySelector('#readable').scrollTop>0);assert.ok(await p.locator('#project-hapi').isVisible()); }
  await p.screenshot({path:`shots/A07-${url===hosted?'hosted':'single'}-${mode}.png`});await ctx.close();
 }
 const ctx=await browser.newContext(), p=await ctx.newPage(), requests=[];
 p.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url())});await p.route('https://**/*',r=>r.abort());
 await p.goto(standalone+'?yours=London');await p.waitForFunction(()=>window.__app?.state.custom,{timeout:30000});
 for(const id of ['resumeBtn','talkCv','buildResume']) {const link=p.locator('#'+id);assert.ok((await link.getAttribute('href')).startsWith('https://nand-world-portfolio.vercel.app/'));assert.ok((await link.textContent()).includes('online'));}
 assert.ok((await p.locator('#cMeta').innerText()).includes('designed street'));
 await p.evaluate(()=>window.__app.ask('voice AI'));await p.waitForTimeout(500);
 assert.deepEqual(requests.filter(u=>!/fonts\.(googleapis|gstatic)\.com/.test(u)),[],'standalone optional network requests');
 await ctx.close();console.log('A07 fallback assertions passed');
} finally {await browser.close();server.httpServer.close();await rm(dir,{recursive:true,force:true});}
