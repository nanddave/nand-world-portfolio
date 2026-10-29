import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';
import { writeFile } from 'node:fs/promises';

const label=process.argv[2] || 'before';
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const browser=await chromium.launch({executablePath:browserPath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}), messages=[];p.on('console',m=>{if(m.text().startsWith('quality:')) messages.push(m.text())});await p.route('https://**/*',r=>r.abort());
 await p.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await p.waitForFunction(()=>window.__app);await p.evaluate(()=>window.__app.enterCity(6));await p.waitForTimeout(12000);
 const frames=await p.evaluate(()=>new Promise(resolve=>{const samples=[];let last=performance.now(),start=last;function tick(now){samples.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(tick);else resolve(samples.slice(1));}requestAnimationFrame(tick);}));frames.sort((a,b)=>a-b);
 const at=q=>Math.round(frames[Math.min(frames.length-1,Math.floor(frames.length*q))]*10)/10;
 const result={label,browser:browser.version(),viewport:'1440x900',method:'Headless software WebGL, localhost, reduced motion; 12 seconds warm-up then 4-second rAF sample.',frameSamples:frames.length,medianFrameMs:at(.5),p95FrameMs:at(.95),messages};
 await p.screenshot({path:`shots/C02-${label}.png`});await writeFile(`shots/C02-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();server.httpServer.close();}
