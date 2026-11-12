import {webkit} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createCanvas} from '@napi-rs/canvas';

const root=resolve(import.meta.dirname,'../..'),dist=resolve(root,'dist'),outDir=resolve(root,'work/v3');
const screenshotDir=process.env.PBS_SCREENSHOT_DIR||'';
await mkdir(outDir,{recursive:true});
if(screenshotDir)await mkdir(screenshotDir,{recursive:true});

const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};

function buildFixtureJpeg(kind,w,h){
 const c=createCanvas(w,h),ctx=c.getContext('2d');
 ctx.fillStyle='#e8dfe3';ctx.fillRect(0,0,w,h);
 if(kind==='straight-lines-bg'){
  ctx.strokeStyle='#6f6269';ctx.lineWidth=Math.max(4,Math.round(w*0.006));
  for(let x=Math.round(w*0.1);x<w;x+=Math.round(w*0.15)){
   ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }
 }
 if(kind==='multi-person'){
  for(const cx of [w*0.28,w*0.52,w*0.76]){
   ctx.fillStyle='#dfb19b';ctx.beginPath();ctx.arc(cx,h*0.42,w*0.09,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#3d2b35';ctx.fillRect(cx-w*0.1,h*0.52,w*0.2,h*0.38);
  }
 }else{
  ctx.fillStyle='#dfb19b';ctx.beginPath();ctx.arc(w*0.5,h*0.38,Math.min(w,h)*0.22,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#782828';ctx.beginPath();ctx.arc(w*0.54,h*0.39,Math.max(4,w*0.008),0,Math.PI*2);ctx.fill();
  if(kind==='complex-hair'){
   ctx.strokeStyle='#2c1d18';ctx.lineWidth=3;
   for(let i=-40;i<=40;i++){
    ctx.beginPath();ctx.moveTo(w*0.5+i*3,h*0.16);ctx.quadraticCurveTo(w*0.5+i*6,h*0.35,w*0.5+i*5,h*0.58);ctx.stroke();
   }
  }
 }
 const buf=c.toBuffer('image/jpeg',88);
 c.width=1;c.height=1;
 return buf;
}

const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  let rel=decodeURIComponent(url.pathname);
  if(rel==='/'||rel==='')rel='/index.html';
  const filePath=resolve(dist,'.'+rel);
  if(!filePath.startsWith(dist)){res.writeHead(403).end();return;}
  const info=await stat(filePath);
  if(!info.isFile()){res.writeHead(404).end();return;}
  const bytes=await readFile(filePath);
  res.writeHead(200,{'Content-Type':mimes[extname(filePath)]||'application/octet-stream','Cache-Control':'no-cache'});
  res.end(bytes);
 }catch{res.writeHead(404).end();}
});

await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {port}=server.address();
const base=`http://127.0.0.1:${port}`;
let browser;

try{
 browser=await webkit.launch({headless:true});
 const context=await browser.newContext({
  viewport:{width:440,height:956},
  deviceScaleFactor:3,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
 });
 const page=await context.newPage();
 await page.goto(`${base}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.Studio&&window.StudioReady);
 await page.evaluate(()=>window.StudioReady);

 if(screenshotDir){
  await page.screenshot({path:resolve(screenshotDir,'v3-home-screen.png')});
 }

 await page.evaluate(async()=>{
  await Studio.ui.closeSheet();
  Studio.ui.showEditor();
  await Studio.facade.fit();
 });
 if(screenshotDir){
  await page.screenshot({path:resolve(screenshotDir,'v3-before-portrait.png')});
 }

 const fixtures=[
  ['portrait-closeup',1200,1600],
  ['portrait-fullbody',1200,1800],
  ['multi-person',1800,1200],
  ['complex-hair',1200,1600],
  ['straight-lines-bg',1200,1600],
  ['highres-12mp',3000,4000],
  ['highres-48mp',6000,8000]
 ];

 const fixtureMetrics=[];
 for(const [name,w,h] of fixtures){
  const buf=buildFixtureJpeg(name,w,h);
  const b64=buf.toString('base64');
  const m=await page.evaluate(async({name,b64,w,h})=>{
   const bin=atob(b64),bytes=new Uint8Array(bin.length);
   for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
   const blob=new Blob([bytes],{type:'image/jpeg'});
   const f=Studio.facade;
   const t0=performance.now();
   await f.open(blob,name);
   const openMs=Math.round(performance.now()-t0);
   const t1=performance.now();
   await f.preview({preset:'ccd',intensity:80,adjustments:{exposure:.15,contrast:10,bloom:15}});
   const previewMs=Math.round(performance.now()-t1);
   const scale=w*h>12000000?Math.sqrt(12000000/(w*h)):0.5;
   const t2=performance.now();
   const jpg=await f.exportImage({format:'jpeg',scale});
   const exportJpgMs=Math.round(performance.now()-t2);
   const t3=performance.now();
   const png=await f.exportImage({format:'png',scale:Math.min(scale,0.25)});
   const exportPngMs=Math.round(performance.now()-t3);
   const canvases=[...document.querySelectorAll('canvas')];
   const canvasBackingMP=Number((canvases.reduce((s,c)=>s+c.width*c.height,0)/1e6).toFixed(2));
   return {name,width:f.config.WIDTH,height:f.config.HEIGHT,megapixels:Number((w*h/1e6).toFixed(1)),openMs,previewMs,exportJpgMs,exportPngMs,jpgBytes:jpg.size,pngBytes:png.size,canvasCount:canvases.length,canvasBackingMP};
  },{name,b64,w,h});
  m.nodeRssMiB=Math.round(process.memoryUsage().rss/1048576);
  m.nodeHeapUsedMiB=Math.round(process.memoryUsage().heapUsed/1048576);
  fixtureMetrics.push(m);
 }

 // Benchmark 50-100 strokes with ROI + prefix stroke cache and worker timeout recovery
 const demoBuf=await readFile(resolve(root,'assets/photos/portrait.jpg'));
 const demoB64=demoBuf.toString('base64');
 const stress=await page.evaluate(async(b64)=>{
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const f=Studio.facade,ui=Studio.ui;
  await f.open(new Blob([bytes],{type:'image/jpeg'}),'portrait-v3');
  const strokes=[];
  let stroke50Ms=0,stroke100Ms=0;
  for(let i=1;i<=100;i++){
   strokes.push({
    type:i%3===0?'brighten':'smooth',
    radius:26,
    strength:0.55,
    hardness:0.5,
    feather:0.45,
    detail:0.65,
    points:[{x:220+(i%20)*12,y:260+Math.floor(i/20)*24},{x:228+(i%20)*12,y:266+Math.floor(i/20)*24}]
   });
   if(i===49||i===50||i===99||i===100){
    const t=performance.now();
    await f.raster.render(f.sources.get(f.basePhotoLayer().studio.sourceId).image,{...f.basePhotoLayer().studio,strokes:strokes.slice()},{edge:960});
    const elapsed=Math.round(performance.now()-t);
    if(i===50)stroke50Ms=elapsed;
    if(i===100)stroke100Ms=elapsed;
   }
  }
  const cachedStrokesAt100=f.raster.stats.lastCachedStrokes;
  const renderedStrokesAt100=f.raster.stats.lastRenderedStrokes;

  // Worker timeout recovery benchmark
  const worker=f.raster.worker;
  const origTimeout=worker.timeoutMs;
  const origPerMp=worker.perMegapixelMs;
  worker.timeoutMs=25;
  worker.perMegapixelMs=0;
  const origFactory=worker.factory;
  let simulatedHang=true;
  worker.factory=()=>{
   if(simulatedHang){
    simulatedHang=false;
    return {postMessage(){},terminate(){}};
   }
   return origFactory();
  };
  worker.worker?.terminate?.();
  worker.worker=null;
  const tw=performance.now();
  const res=await worker.run({pixels:new Uint8ClampedArray(64*64*4),width:64,height:64,params:{brightness:12}},{recover:()=>new Uint8ClampedArray(64*64*4)});
  const workerRecoveryMs=Math.round(performance.now()-tw);
  worker.timeoutMs=origTimeout;
  worker.perMegapixelMs=origPerMp;
  worker.factory=origFactory;

  // Apply showcase V3 edits for After screenshot
  await ui.switchCategory('face');
  await f.addStroke({type:'smooth',radius:42,strength:.72,hardness:.5,feather:.5,detail:.68,points:[{x:420,y:480},{x:480,y:520}]});
  await ui.switchCategory('color');
  await ui.switchTool('filters');
  await f.updateStudio({preset:'muse',intensity:82,adjustments:{exposure:.12,contrast:8,bloom:18,halation:14}});
  return {
   stroke50Ms,
   stroke100Ms,
   cachedStrokesAt100,
   renderedStrokesAt100,
   workerRecoveryMs,
   workerRestarts:worker.restarts,
   workerRecoveredLen:res.length
  };
 },demoB64);

 assert.equal(stress.cachedStrokesAt100,99);
 assert.equal(stress.renderedStrokesAt100,1);
 assert.equal(stress.workerRecoveredLen,64*64*4);

 if(screenshotDir){
  await page.screenshot({path:resolve(screenshotDir,'v3-after-portrait-filters.png')});
  await page.evaluate(async()=>{await Studio.ui.switchCategory('face');});
  await page.screenshot({path:resolve(screenshotDir,'v3-category-face-beauty.png')});
  await page.evaluate(async()=>{await Studio.ui.switchCategory('body');});
  await page.screenshot({path:resolve(screenshotDir,'v3-category-body-reshape.png')});
  await page.evaluate(async()=>{await Studio.ui.switchTool('makeup');await Studio.ui.selectMakeupRole('hair');});
  await page.screenshot({path:resolve(screenshotDir,'v3-makeup-hair-studio.png')});
 }

 const report={
  timestamp:new Date().toISOString(),
  environment:`Playwright WebKit (${browser.version()}) emulating iPhone 16 Pro Max (440x956 @ 3x DPR). Desktop WebKit emulation — NOT a physical iPhone 16 Pro Max hardware device.`,
  fixtures:fixtureMetrics,
  strokeAndWorkerStress:stress
 };
 await writeFile(resolve(outDir,'qa-report.json'),JSON.stringify(report,null,2));
 console.log('V3 Benchmark & QA completed successfully. Saved to work/v3/qa-report.json');
}finally{
 await browser?.close();
 server.close();
}
