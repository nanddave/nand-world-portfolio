import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'}); await server.listen();
const browser=await chromium.launch({executablePath:browserPath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[]; mkdirSync('shots',{recursive:true});
try {
 for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
  const page=await browser.newPage({viewport:{width,height}}); page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  for(const [name,query] of [['intro',''],['nadiad','?stop=nadiad'],['seattle','?stop=seattle'],['recruiter','?role=recruiter']]) {
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${query}`); await page.waitForFunction(()=>window.__ready); await page.waitForTimeout(1200);
   await page.screenshot({path:`shots/before-${name}-${size}.png`});
  }
  await page.close();
 }
 writeFileSync('shots/baseline-errors.json',JSON.stringify(errors,null,2)); console.log({errors,screenshots:8});
} finally {await browser.close();await server.close();}
