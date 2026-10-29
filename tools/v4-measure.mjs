import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { browserPath } from './browser.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const browser=await chromium.launch({executablePath:browserPath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const origin=`http://127.0.0.1:${server.httpServer.address().port}/`, results={browser:browser.version(),method:'Headless Chromium, software WebGL, localhost; external requests blocked; not a physical-device benchmark.',runs:[]};
try {
 await mkdir('shots',{recursive:true});
 for(const [width,height] of [[390,844],[1440,900]]) {
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}), p=await ctx.newPage();await p.route('https://**/*',r=>r.abort());
  for(const cache of ['cold','warm']) {const start=Date.now();await p.goto(origin);await p.waitForFunction(()=>window.__app);const nav=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {domContentLoadedMs:Math.round(n.domContentLoadedEventEnd),transferBytes:n.transferSize}});results.runs.push({width,height,cache,appReadyWallMs:Date.now()-start,...nav});}
  for(const ci of [0,4,6]) {
   if(ci!==0) await p.evaluate(()=>window.__app.exitCity());
   const start=Date.now();await p.evaluate(ci=>window.__app.enterCity(ci),ci);const enterMs=Date.now()-start;
   const frames=await p.evaluate(()=>new Promise(resolve=>{const samples=[];let last=performance.now(),start=last;function frame(now){samples.push(now-last);last=now;if(now-start<3000) requestAnimationFrame(frame);else resolve(samples.slice(1));}requestAnimationFrame(frame);}));
   frames.sort((a,b)=>a-b);const percentile=q=>Math.round(frames[Math.min(frames.length-1,Math.floor(frames.length*q))]*10)/10;
   results.runs.push({width,height,city:ci,enterMs,frameSamples:frames.length,medianFrameMs:percentile(.5),p95FrameMs:percentile(.95)});
   await p.screenshot({path:`shots/C01-${width}-${ci}.png`});
  }
  await ctx.close();
 }
 await writeFile('shots/C01-lab.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} finally {await browser.close();server.httpServer.close();}
