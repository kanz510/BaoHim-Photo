import {webkit} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

const root=resolve(import.meta.dirname,'../..'),dist=resolve(root,'dist');
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};

const requestedUrls=[];
const externalUrls=[];
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  let rel=decodeURIComponent(url.pathname);
  requestedUrls.push(rel);
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
const errors=[];
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
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',req=>{
  const u=new URL(req.url());
  if(u.hostname!=='127.0.0.1'&&u.protocol!=='blob:'&&u.protocol!=='data:'){
   externalUrls.push(req.url());
  }
 });

 const tBoot0=performance.now();
 await page.goto(`${base}/index.html?ui=v4`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.Studio&&window.StudioReady);
 await page.evaluate(()=>window.StudioReady);
 const bootMs=Math.round(performance.now()-tBoot0);

 // 1. Verify initial boot state & lazy-loading (Makeup, Creative, LUT, FX chunks are NOT in DOM <head> before use)
 const bootState=await page.evaluate(async()=>{
  const lazyScripts=[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')||'');
  const prematureLazy=lazyScripts.filter(s=>/studio-(makeup|creative|lut|fx)\./.test(s));
  await Studio.ui.closeSheet();
  Studio.ui.showEditor();
  await Studio.facade.fit();
  const c=document.querySelector('#canvas_minipaint');
  const navButtons=[...document.querySelectorAll('#mobile-nav button')];
  const minTouchHeight=Math.min(...navButtons.map(b=>b.getBoundingClientRect().height));
  return {
   title:document.title,
   width:Studio.facade.config.WIDTH,
   height:Studio.facade.config.HEIGHT,
   backingW:c.width,
   logicalW:c.studioViewportWidth,
   legacyMenu:document.querySelectorAll('.native-support,#main_menu,#zoom_range').length,
   prematureLazy,
   minTouchHeight
  };
 });
 assert.ok(bootState.title.includes('BaoHim Photo'));
 assert.ok(bootState.width>0&&bootState.height>0);
 assert.equal(bootState.backingW,Math.round(bootState.logicalW*3));
 assert.equal(bootState.legacyMenu,0);
 assert.deepEqual(bootState.prematureLazy,[],'Makeup, Creative, LUT, and FX chunks must not be loaded into <head> before user interaction');
 assert.ok(bootState.minTouchHeight>=36,'Mobile dock touch targets meet minimum ergonomic height');

 // 2. GPU Liquify vs CPU Liquify Accuracy & Performance Benchmark in WebKit
 const gpuAccuracyAndBench=await page.evaluate(async()=>{
  const {facade:f}=window.Studio;
  // Create deterministic RGBA test pattern with alpha channel variations
  const w=256,h=256,src=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++){
   for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    src[i]=(x*7+y*3)&255;
    src[i+1]=(x*5+y*11+40)&255;
    src[i+2]=(x*13+y*2+90)&255;
    src[i+3]=x<24?0:x<64?140:255;
   }
  }
  // 2a. strength=0 must be 100% identity
  const zeroCheck=f.raster.compareWarpAccuracy(src,w,h,{
   warps:[
    {from:{x:120,y:120},to:{x:155,y:140},radius:60,strength:0,mode:'push'},
    {from:{x:100,y:100},to:{x:100,y:100},radius:50,strength:0,mode:'pinch'}
   ]
  });
  // 2b. Push, Pinch, Bulge, Restore, Freeze (with erase & freezeCount), Perspective, Alpha, and Outside-Radius check
  const radius=45,cx=128,cy=128;
  const fullRecipe={
   perspectiveX:14,
   perspectiveY:-10,
   freezes:[
    {points:[{x:120,y:120},{x:135,y:128}],radius:24,hardness:.8,strength:.9},
    {points:[{x:125,y:122}],radius:12,hardness:.7,strength:.8,erase:true}
   ],
   warps:[
    {from:{x:cx,y:cy},to:{x:cx+18,y:cy-12},radius,strength:.75,mode:'push',freezeCount:2},
    {from:{x:cx+10,y:cy+8},to:{x:cx+10,y:cy+8},radius:38,strength:.55,mode:'pinch',freezeCount:2},
    {from:{x:cx-12,y:cy-6},to:{x:cx-12,y:cy-6},radius:34,strength:.5,mode:'bulge',freezeCount:2},
    {from:{x:cx+4,y:cy},to:{x:cx+4,y:cy},radius:20,strength:.4,mode:'restore',freezeCount:2}
   ]
  };
  const fullCheck=f.raster.compareWarpAccuracy(src,w,h,fullRecipe,1);
  let firstBigDiff=null;
  if(fullCheck.gpuAvailable&&fullCheck.maxDiff>1){
   for(let y=0;y<h&&!firstBigDiff;y++){
    for(let x=0;x<w&&!firstBigDiff;x++){
     const idx=(y*w+x)*4;
     for(let c=0;c<4;c++){
      const d=Math.abs(fullCheck.gpu[idx+c]-fullCheck.cpu[idx+c]);
      if(d>1){
       firstBigDiff={x,y,c,d,gpu:Array.from(fullCheck.gpu.slice(idx,idx+4)),cpu:Array.from(fullCheck.cpu.slice(idx,idx+4)),src:Array.from(src.slice(idx,idx+4))};
       break;
      }
     }
    }
   }
  }
  // 2c. Outside-radius check (without perspective)
  const localOnlyRecipe={
   warps:[{from:{x:128,y:128},to:{x:144,y:136},radius:36,strength:.8,mode:'push',freezeCount:0}]
  };
  const localCheck=f.raster.compareWarpAccuracy(src,w,h,localOnlyRecipe,1);
  let outsideDiff=0;
  if(localCheck.gpuAvailable){
   for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
     if(Math.hypot(x-128,y-128)>40){
      const idx=(y*w+x)*4;
      for(let c=0;c<4;c++)outsideDiff=Math.max(outsideDiff,Math.abs(localCheck.gpu[idx+c]-src[idx+c]));
     }
    }
   }
  }
  // 2d. Benchmark CPU vs GPU Liquify across 1280x1024 (1.3 MP preview) and 2560x2048 (5.2 MP)
  const benchWarps=Array.from({length:8},(_,k)=>({
   from:{x:300+k*70,y:300+(k%3)*90},
   to:{x:322+k*70,y:285+(k%3)*90},
   radius:95,
   strength:.68,
   mode:k%3===0?'push':k%3===1?'pinch':'bulge',
   freezeCount:1
  }));
  const benchStudio={
   freezes:[{points:[{x:260,y:260},{x:340,y:320}],radius:45,hardness:.8,strength:.85}],
   warps:benchWarps
  };
  const runBench=(bw,bh)=>{
   const buf=new Uint8ClampedArray(bw*bh*4);
   for(let i=0;i<buf.length;i+=4){buf[i]=180;buf[i+1]=140;buf[i+2]=125;buf[i+3]=255;}
   const res=f.raster.compareWarpAccuracy(buf,bw,bh,benchStudio,bw/1280);
   return {width:bw,height:bh,megapixels:Number((bw*bh/1e6).toFixed(2)),gpuMs:res.gpuMs,cpuMs:res.cpuMs,speedup:res.gpuAvailable&&res.gpuMs>0?Number((res.cpuMs/res.gpuMs).toFixed(2)):null,maxDiff:res.maxDiff,meanAbsDiff:res.meanAbsDiff};
  };
  const bench13MP=runBench(1280,1024);
  const bench52MP=runBench(2560,2048);
  return {
   gpuAvailable:fullCheck.gpuAvailable,
   zeroMaxDiff:zeroCheck.maxDiff,
   outsideDiff,
   fullMaxDiff:fullCheck.maxDiff,
   firstBigDiff,
   fullMeanAbsDiff:fullCheck.meanAbsDiff,
   fullExactMatchRatio:fullCheck.exactMatchRatio,
   bench13MP,
   bench52MP,
   webglStats:f.raster.getWebGLStats()
  };
 });
 assert.equal(gpuAccuracyAndBench.gpuAvailable,true,'WebGL2 GPU Liquify must be active in WebKit');
 assert.equal(gpuAccuracyAndBench.zeroMaxDiff,0,'strength=0 warp must produce 0 pixel difference');
 assert.equal(gpuAccuracyAndBench.outsideDiff,0,'pixels outside warp radius must remain 100% untouched');
 if(gpuAccuracyAndBench.firstBigDiff)console.error('FIRST_BIG_DIFF:',JSON.stringify(gpuAccuracyAndBench));
 assert.ok(gpuAccuracyAndBench.fullMaxDiff<=1,`GPU vs CPU max channel diff must be <= 1 LSB (got ${gpuAccuracyAndBench.fullMaxDiff})`);
 assert.ok(gpuAccuracyAndBench.webglStats.gpuRuns>=4);

 // 3. Verify WebGL context loss automatic CPU fallback and recovery
 const fallbackCheck=await page.evaluate(async()=>{
  const {facade:f}=window.Studio;
  f.raster.setWebGLContextLostForTest(true);
  await f.updateStudio({warps:[{from:{x:300,y:400},to:{x:320,y:410},radius:65,strength:.6,mode:'push',freezeCount:0}]});
  const backendDuringLoss=f.raster.stats.lastWarpBackend;
  f.raster.setWebGLContextLostForTest(false);
  await f.updateStudio({warps:[{from:{x:300,y:400},to:{x:325,y:415},radius:65,strength:.65,mode:'push',freezeCount:0}]});
  const backendAfterRestore=f.raster.stats.lastWarpBackend;
  await f.undo();
  await f.undo();
  return {backendDuringLoss,backendAfterRestore};
 });
 assert.ok(['worker','cpu'].includes(fallbackCheck.backendDuringLoss),'Lost WebGL context must fall back automatically to worker/CPU');
 assert.equal(fallbackCheck.backendAfterRestore,'webgl2','Restored WebGL context must resume WebGL2 GPU Liquify');

 // 3a. Meitu Compact Layout & 100% Unclipped Photo Visibility (Portrait 1000x1500, Landscape 1500x1000, Square 1000x1000, Full-Body 1000x2000)
 const aspectCases=[[1000,1500,'portrait-1000x1500'],[1500,1000,'landscape-1500x1000'],[1000,1000,'square-1000x1000'],[1000,2000,'fullbody-1000x2000']];
 for(const [tw,th,label] of aspectCases){
  const aspectAudit=await page.evaluate(async([w,h])=>{
   const {facade:f,ui}=window.Studio;
   const rafTick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const cTmp=document.createElement('canvas');cTmp.width=w;cTmp.height=h;
   const x=cTmp.getContext('2d');
   const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#e8d5de');g.addColorStop(.5,'#cfa0b4');g.addColorStop(1,'#875c70');
   x.fillStyle=g;x.fillRect(0,0,w,h);
   x.strokeStyle='#ffffff';x.lineWidth=16;x.strokeRect(8,8,w-16,h-16);
   const blob=await new Promise(r=>cTmp.toBlob(r,'image/png'));cTmp.width=1;
   await f.open(blob,`${w}x${h}.png`);
   await ui.switchTool('filters');
   await rafTick();
   const wrapper=document.getElementById('main_wrapper').getBoundingClientRect();
   const canvas=document.getElementById('canvas_minipaint').getBoundingClientRect();
   const sheet=document.getElementById('studio-inspector').getBoundingClientRect();
   const navStyle=getComputedStyle(document.getElementById('mobile-nav'));
   const thumb=document.querySelector('.v2-filter-strip .filter-preview')?.getBoundingClientRect();
   const ratioCanvas=canvas.width/canvas.height,ratioDoc=w/h;
   const fullBodyZoomInTools=[];
   for(const t of ['filters','beauty','makeup','reshape','adjust','text']){
    await ui.switchTool(t);await rafTick();fullBodyZoomInTools.push(f.config.ZOOM);
   }
   await ui.switchTool('filters');await rafTick();
   return {
    wrapper,canvas,sheet,navDisplay:navStyle.display,
    thumbW:thumb?.width||0,thumbH:thumb?.height||0,
    ratioDiff:Math.abs(ratioCanvas-ratioDoc),
    fullVisibleWidth:canvas.width<=wrapper.width+1&&canvas.left>=wrapper.left-1&&canvas.right<=wrapper.right+1,
    fullVisibleHeight:canvas.height<=wrapper.height+1&&canvas.top>=wrapper.top-1&&canvas.bottom<=wrapper.bottom+1,
    noOverlapSheet:canvas.bottom<=sheet.top+1,
    renderedFullDoc:Math.abs(canvas.width-w*f.config.ZOOM)<2&&Math.abs(canvas.height-h*f.config.ZOOM)<2,
    zoomsConsistentAcrossTools:fullBodyZoomInTools.every(z=>Math.abs(z-fullBodyZoomInTools[0])<1e-6)
   };
  },[tw,th]);
  assert.equal(aspectAudit.navDisplay,'none',`${label}: bottom nav must hide when compact tool sheet is open`);
  assert.ok(aspectAudit.sheet.height>=160&&aspectAudit.sheet.height<=220,`${label}: compact sheet height (${aspectAudit.sheet.height}) must stay in 160-220px`);
  assert.ok(aspectAudit.thumbH>=54&&aspectAudit.thumbH<=70,`${label}: filter thumbnail height (${aspectAudit.thumbH}) must stay compact ~58-70px`);
  assert.ok(aspectAudit.ratioDiff<0.02,`${label}: aspect ratio distorted (diff=${aspectAudit.ratioDiff})`);
  assert.equal(aspectAudit.fullVisibleWidth,true,`${label}: canvas horizontally clipped or outside wrapper`);
  assert.equal(aspectAudit.fullVisibleHeight,true,`${label}: canvas vertically clipped or outside wrapper`);
  assert.equal(aspectAudit.noOverlapSheet,true,`${label}: canvas overlapped bottom toolbar (${aspectAudit.canvas.bottom} > ${aspectAudit.sheet.top})`);
  assert.equal(aspectAudit.renderedFullDoc,true,`${label}: canvas CSS size did not render 100% of W*ZOOM x H*ZOOM`);
  assert.equal(aspectAudit.zoomsConsistentAcrossTools,true,`${label}: zoom changed while switching Filter/Beauty/Makeup/Reshape/Adjust/Text`);
  if(process.env.SCREENSHOT_DIR&&(label==='portrait-1000x1500'||label==='fullbody-1000x2000')){
   await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR,`after-${label}-filters.png`)});
  }
 }

 // 3b. Viewport Zoom & Anchor Stability Regression (iPhone 16 Pro Max 440x956 DPR3)
 await page.evaluate(async()=>{
  await window.Studio.facade.openDemo('portrait');
  await window.Studio.ui.closeSheet();
  window.Studio.ui.showEditor();
  await window.Studio.facade.fit();
 });
 await page.waitForTimeout(60);
 const zoomSwitch30=await page.evaluate(async()=>{
  const {facade:f,ui}=window.Studio;
  const rafTick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const fitZoom=f.config.ZOOM;
  const canvas=document.getElementById('canvas_minipaint');
  const fitLabel=document.getElementById('zoom-value').textContent;
  const sequence=['auto','beauty','reshape','filters','adjust','makeup','text','stickers','frames','geometry','layers','draw'];
  const zoomTrace=[];
  for(let i=0;i<30;i++){
   if(i%5===0){await ui.switchCategory(['auto','face','body','color','creative'][Math.floor(i/5)%5]);}
   else{await ui.switchTool(sequence[i%sequence.length]);}
   await rafTick();
   zoomTrace.push({i,tool:ui.tool,zoom:f.config.ZOOM,label:document.getElementById('zoom-value').textContent,cw:canvas.studioViewportWidth,ch:canvas.studioViewportHeight});
  }
  return {fitZoom,fitLabel,zoomTrace};
 });
 for(const step of zoomSwitch30.zoomTrace){
  assert.equal(step.zoom,zoomSwitch30.fitZoom,`30x switch #${step.i} (${step.tool}) changed ZOOM: ${step.zoom} vs ${zoomSwitch30.fitZoom}`);
  assert.equal(step.label,zoomSwitch30.fitLabel,`30x switch #${step.i} (${step.tool}) changed #zoom-value`);
 }

 const manual200Stability=await page.evaluate(async()=>{
  const {facade:f,ui}=window.Studio;
  const rafTick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const canvas=document.getElementById('canvas_minipaint');
  await f.fit();
  await f.zoom(2/f.config.ZOOM);
  f.pan(140,-180);
  await rafTick();
  const zBefore=f.config.ZOOM;
  const labelBefore=document.getElementById('zoom-value').textContent;
  const centerBefore=f.app.Layers.studioScreenToWorld({x:canvas.studioViewportWidth/2,y:canvas.studioViewportHeight/2});

  // Rapidly switch across Face Reshape, Body Reshape, Makeup, Filter, Typography & 5 more tools + subtools
  const steps=[];
  const check=async tag=>{
   await rafTick();
   const center=f.app.Layers.studioScreenToWorld({x:canvas.studioViewportWidth/2,y:canvas.studioViewportHeight/2});
   steps.push({
    tag,
    zoom:f.config.ZOOM,
    label:document.getElementById('zoom-value').textContent,
    dprBackingOk:canvas.width===Math.round(canvas.studioViewportWidth*3),
    dx:Math.abs(center.x-centerBefore.x),
    dy:Math.abs(center.y-centerBefore.y)
   });
  };
  await ui.switchCategory('face');
  ui.reshapeMode='face';await ui.switchTool('reshape');await check('face-reshape');
  await ui.switchCategory('body');await check('body-reshape');
  await ui.switchTool('makeup');await ui.openMakeupRole('lips');await check('makeup-lips');
  await ui.switchTool('filters');await check('filter');
  await ui.switchTool('text');ui.textTab='style';ui.renderPanel();await check('typography');
  await ui.switchTool('adjust');await check('adjust');
  await ui.switchTool('layers');await check('layers');
  await ui.switchTool('geometry');ui.geometryTab='rotate';ui.renderPanel();await check('geometry');
  await ui.switchTool('auto');await check('auto');
  await ui.switchTool('draw');await check('draw');

  // Bottom sheet detents: peek -> expanded -> compact -> closed
  ui.sheet.set('peek');await check('sheet-peek');
  ui.sheet.set('expanded');await check('sheet-expanded');
  ui.sheet.set('compact');await check('sheet-compact');
  await ui.closeSheet();await check('sheet-closed');
  await ui.switchTool('reshape');await check('sheet-reopen-reshape');
  return {zBefore,labelBefore,centerBefore,steps};
 });
 assert.equal(manual200Stability.zBefore,2);
 assert.equal(manual200Stability.labelBefore,'200%');
 for(const s of manual200Stability.steps){
  assert.equal(s.zoom,2,`200% zoom changed at ${s.tag}: ${s.zoom}`);
  assert.equal(s.label,'200%',`#zoom-value changed at ${s.tag}: ${s.label}`);
  assert.equal(s.dprBackingOk,true,`DPR3 backing mismatch at ${s.tag}`);
  assert.ok(s.dx<1&&s.dy<1,`Center anchor drifted at ${s.tag}: dx=${s.dx.toFixed(2)}, dy=${s.dy.toFixed(2)}`);
 }

 // Real pointer drag on bottom sheet + Safari address-bar height simulation via Playwright at 200% zoom
 const dragHandle=await page.locator('.sheet-drag-zone').boundingBox();
 if(dragHandle){
  const sx=dragHandle.x+dragHandle.width/2,sy=dragHandle.y+dragHandle.height/2;
  await page.mouse.move(sx,sy);
  await page.mouse.down();
  await page.mouse.move(sx,sy-180,{steps:6});
  await page.mouse.up();
 }
 await page.waitForTimeout(80);
 await page.setViewportSize({width:440,height:860});
 await page.waitForTimeout(80);
 await page.setViewportSize({width:440,height:956});
 await page.waitForTimeout(80);
 const afterDragAndSafariBar=await page.evaluate(async()=>{
  const {facade:f,ui}=window.Studio;
  const c=document.getElementById('canvas_minipaint');
  const center=f.app.Layers.studioScreenToWorld({x:c.studioViewportWidth/2,y:c.studioViewportHeight/2});
  const zoomBeforeFit=f.config.ZOOM;
  await ui.action('fit');
  const zoomAfterExplicitFit=f.config.ZOOM;
  return {zoomBeforeFit,label:document.getElementById('zoom-value').textContent,center,zoomAfterExplicitFit};
 });
 assert.equal(afterDragAndSafariBar.zoomBeforeFit,2,'Pointer sheet drag + Safari bar resize must keep 200% zoom');
 assert.ok(Math.abs(afterDragAndSafariBar.center.x-manual200Stability.centerBefore.x)<1.5);
 assert.ok(Math.abs(afterDragAndSafariBar.center.y-manual200Stability.centerBefore.y)<1.5);
 assert.ok(afterDragAndSafariBar.zoomAfterExplicitFit<1,'Explicit Vừa khung action must still refit cleanly');
 if(process.env.SCREENSHOT_DIR){
  await page.evaluate(async()=>{await window.Studio.facade.openDemo('portrait');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.waitForTimeout(350);
  await page.evaluate(async()=>{await window.Studio.ui.switchTool('filters');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.waitForTimeout(200);
  await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR,'after-demo-portrait-filters.png')});
  await page.evaluate(async()=>{await window.Studio.ui.switchTool('beauty');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.waitForTimeout(160);
  await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR,'after-demo-portrait-beauty.png')});
 }

 // 4. Full V3 workflow: Zoom/Pan, Orientation Rotate, Auto/Color, Beauty, Heal/Blemish, Face/Body Reshape, Makeup/Hair, Filter/LUT, Creative, Continuous Undo/Redo, Background/Foreground, PNG/JPEG Open & Export
 const editResult=await page.evaluate(async()=>{
  const {facade:f,ui}=window.Studio;
  // 4a. Open PNG with alpha channel first, then re-open demo JPEG
  const pngCanvas=document.createElement('canvas');pngCanvas.width=320;pngCanvas.height=400;
  const pctx=pngCanvas.getContext('2d');pctx.fillStyle='rgba(215,165,145,0.92)';pctx.fillRect(20,20,280,360);
  const pngBlob=await new Promise(r=>pngCanvas.toBlob(r,'image/png'));
  const tOpenPng0=performance.now();
  await f.open(pngBlob,'Alpha Portrait.png');
  const openPngMs=Math.round(performance.now()-tOpenPng0);
  const tOpenJpg0=performance.now();
  await f.openDemo('portrait');
  const openJpgMs=Math.round(performance.now()-tOpenJpg0);

  // 4b. Pinch Zoom & Pan
  const z0=f.config.ZOOM;
  await f.zoom(1.35);
  const zoomed=f.config.ZOOM>z0;
  f.pan(18,-12);
  await f.fit();

  // 4c. Auto & Color + Filter + .cube 3D LUT (lazy-loads studio-lut) + Optical effects + Sharpen (lazy-loads studio-fx)
  await ui.switchCategory('auto');
  await ui.applyAutoEnhance('portrait',80);
  await ui.commitDraft();
  await ui.switchCategory('color');
  document.querySelector('[data-v2-cube-lut="kodak-2383"]').click();
  await new Promise(r=>setTimeout(r,40));
  await ui.commitDraft();
  await f.updateStudio({preset:'ccd',intensity:80,adjustments:{bloom:22,halation:18,sharpen:18}});

  // 4d. Beauty: Skin Smooth + Blemish + Heal
  await ui.switchCategory('face');
  await f.addStroke({type:'smooth',radius:36,strength:.7,hardness:.5,feather:.45,detail:.7,points:[{x:300,y:400},{x:320,y:410}]});
  await f.addStroke({type:'blemish',radius:10,strength:.9,hardness:.65,feather:.4,points:[{x:285,y:395}]});
  await f.addStroke({type:'heal',radius:28,strength:.8,hardness:.5,cloneSource:{x:260,y:380},points:[{x:310,y:420}]});
  const cachedStrokes=f.raster.stats.lastCachedStrokes;
  const renderedStrokes=f.raster.stats.lastRenderedStrokes;

  // 4e. Face Reshape (mesh control points -> WebGL2 GPU Liquify)
  await ui.switchTool('reshape');
  ui.reshapePreset='jawline';
  await ui.action('face-place');
  ui.faceAmount=50;
  await ui.action('apply-face');
  const faceWarps=f.basePhotoLayer().studio.warps.length;
  const warpBackend=f.raster.stats.lastWarpBackend;

  // 4f. Body Reshape + Background Pin
  await ui.switchCategory('body');
  await f.addStroke({type:'freeze',points:[{x:90,y:300}],radius:32,hardness:.88,strength:1});
  ui.brush.mode='curve';
  ui.router.bodyHandles=[{x:160,y:260},{x:175,y:380}];
  await ui.action('apply-body');
  const totalWarps=f.basePhotoLayer().studio.warps.length;

  // 4g. Makeup & Hair Studio (lazy-loads studio-makeup)
  await ui.switchTool('makeup');
  await ui.applyMakeupPreset('douyin');
  await ui.selectMakeupRole('hair');
  await f.addStroke({type:'makeup',points:[{x:220,y:160}],radius:40,strength:.5,hardness:.4,feather:.55,color:'#6e473b',blend:'soft-light'});

  // 4h. Creative Studio: Typography, Sticker, Collage (lazy-loads studio-creative)
  await ui.switchCategory('creative');
  await f.addText('BaoHim V3 · Đẹp tự nhiên');
  await f.updateText({typography:{arc:18,gradient:{enabled:true,from:'#ffffff',to:'#d96792',angle:35}}});
  await f.addSticker('sparkle');

  // 4i. Continuous Undo/Redo (8 steps back and 8 steps forward)
  const historyBefore=f.app.State.action_history_index;
  let undoSteps=0;
  for(let i=0;i<8;i++){if(f.app.State.can_undo()){await f.undo();undoSteps++;}}
  const historyAfterUndo=f.app.State.action_history_index;
  for(let i=0;i<undoSteps;i++){if(f.app.State.can_redo())await f.redo();}
  const historyAfterRedo=f.app.State.action_history_index;

  // 4j. Save & Reopen project
  await f.save();
  const savedProject=await f.repository.load(f.id);
  await f.restore(savedProject);

  // 4k. Collage + Undo back to multi-layer portrait
  await f.collage('duo',20);
  const collageLayers=f.config.layers.filter(l=>l.type==='image'&&!l.studio?.sticker&&!l.studio?.makeup).length;
  await f.undo();

  // 4l. Export JPG & PNG timing
  const tExpJpg0=performance.now();
  const jpg=await f.exportImage({format:'jpeg',scale:.5});
  const exportJpgMs=Math.round(performance.now()-tExpJpg0);
  const tExpPng0=performance.now();
  const png=await f.exportImage({format:'png',scale:.5});
  const exportPngMs=Math.round(performance.now()-tExpPng0);

  return {
   openPngMs,
   openJpgMs,
   exportJpgMs,
   exportPngMs,
   zoomed,
   preset:f.basePhotoLayer().studio.preset,
   lutName:f.basePhotoLayer().studio.lut?.name,
   cachedStrokes,
   renderedStrokes,
   faceWarps,
   totalWarps,
   warpBackend,
   undoSteps,
   historyBefore,
   historyAfterUndo,
   historyAfterRedo,
   collageLayers,
   hasHairLayer:f.config.layers.some(l=>l.studio?.makeup?.role==='hair'),
   hasTextLayer:f.config.layers.some(l=>l.type==='text'),
   hasStickerLayer:f.config.layers.some(l=>l.studio?.sticker),
   jpgSize:jpg.size,
   pngSize:png.size
  };
 });
 assert.equal(editResult.zoomed,true);
 assert.equal(editResult.preset,'ccd');
 assert.equal(editResult.lutName,'Kodak 2383 .cube');
 assert.equal(editResult.cachedStrokes,2);
 assert.equal(editResult.renderedStrokes,1);
 assert.equal(editResult.warpBackend,'webgl2');
 assert.ok(editResult.faceWarps>=2);
 assert.ok(editResult.totalWarps>editResult.faceWarps);
 assert.equal(editResult.undoSteps,8);
 assert.equal(editResult.historyAfterUndo,editResult.historyBefore-8);
 assert.equal(editResult.historyAfterRedo,editResult.historyBefore);
 assert.equal(editResult.collageLayers,2);
 assert.equal(editResult.hasHairLayer,true);
 assert.equal(editResult.hasTextLayer,true);
 assert.equal(editResult.hasStickerLayer,true);
 assert.ok(editResult.jpgSize>1000);
 assert.ok(editResult.pngSize>1000);

 // 5. Orientation Rotate (Portrait 440x956 -> Landscape 956x440 -> Portrait 440x956) & Background/Foreground transition
 await page.setViewportSize({width:956,height:440});
 await page.waitForTimeout(80);
 await page.setViewportSize({width:440,height:956});
 await page.waitForTimeout(80);

 const lifecycleAnd12MP=await page.evaluate(async()=>{
  const {facade:f,ui}=window.Studio;
  // Simulate app going to background and returning to foreground
  Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));
  const trackedAfterHidden=f.raster.trackedEntries.size;
  Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(r=>setTimeout(r,30));

  // Virtual keyboard compact sheet check
  await ui.switchTool('text');
  ui.sheet.keyboard=true;
  const keyboardCompactStop=ui.sheet.stops().compact;
  ui.sheet.keyboard=false;

  // 12 MP (4000x3000) synthetic photo open, GPU Liquify & 12 MP JPEG export benchmark
  const c12=document.createElement('canvas');c12.width=4000;c12.height=3000;
  const ctx12=c12.getContext('2d');
  ctx12.fillStyle='#c99eab';ctx12.fillRect(0,0,4000,3000);
  ctx12.fillStyle='#e2bfcb';ctx12.fillRect(800,400,2400,2200);
  const blob12=await new Promise(r=>c12.toBlob(r,'image/jpeg',.9));
  c12.width=1;

  const tOpen12=performance.now();
  await f.open(blob12,'12MP Safari QA.jpg');
  const open12Ms=Math.round(performance.now()-tOpen12);

  const tLiquify12=performance.now();
  await f.updateStudio({
   preset:'peach',
   intensity:75,
   warps:[
    {from:{x:2000,y:1500},to:{x:2080,y:1460},radius:320,strength:.7,mode:'push',freezeCount:0},
    {from:{x:1800,y:1600},to:{x:1800,y:1600},radius:280,strength:.55,mode:'pinch',freezeCount:0}
   ]
  });
  const liquifyPreview12Ms=Math.round(performance.now()-tLiquify12);

  const tExport12=performance.now();
  const exported12=await f.exportImage({format:'jpeg',scale:1,quality:.92});
  const export12Ms=Math.round(performance.now()-tExport12);

  // Verify > 12.5 MP export guard remains enforced
  let guardRejected=false;
  try{
   await f.exportImage({format:'jpeg',scale:1.2});
  }catch{
   guardRejected=true;
  }

  return {
   trackedAfterHidden,
   keyboardCompactStop,
   width12:f.config.WIDTH,
   height12:f.config.HEIGHT,
   open12Ms,
   liquifyPreview12Ms,
   export12Ms,
   export12Bytes:exported12.size,
   guardRejected,
   webglStats:f.raster.getWebGLStats()
  };
 });
 assert.equal(lifecycleAnd12MP.trackedAfterHidden,0,'Background visibilitychange trims cached canvases immediately');
 assert.ok(lifecycleAnd12MP.keyboardCompactStop<=188,'Sheet compact stop shrinks when virtual keyboard is active');
 assert.equal(lifecycleAnd12MP.width12,4000);
 assert.equal(lifecycleAnd12MP.height12,3000);
 assert.ok(lifecycleAnd12MP.export12Bytes>10000);
 assert.equal(lifecycleAnd12MP.guardRejected,true,'12.5 MP export limit remains strictly enforced');

 // 6. Verify Service Worker offline cache & offline operation with zero external network calls
 await page.evaluate(async()=>{
  await navigator.serviceWorker?.ready;
  await Studio.facade.newMakeupLayer(Studio.ui.makeupMode||'lips');
 });
 const inventory=JSON.parse(await readFile(resolve(dist,'asset-inventory.json'),'utf8'));
 const lazyChunkPaths=inventory.files.filter(f=>/studio-(makeup|creative|lut|fx)\./.test(f));
 await context.setOffline(true);
 const offlineFailedReqs=[];
 const onFailed=r=>offlineFailedReqs.push({url:r.url(),reason:r.failure()?.errorText});
 page.on('requestfailed',onFailed);
 const offlineCheck=await page.evaluate(async chunkPaths=>{
  const keys=await caches.keys();
  const cachedIndex=await caches.match('./index.html');
  const cachedPortrait=await caches.match('./assets/photos/portrait.jpg');
  const cachedLazyChunks=await Promise.all(chunkPaths.map(async p=>Boolean(await caches.match(p))));
  await Studio.ui.switchCategory('face');
  await Studio.ui.switchTool('makeup');
  await Studio.ui.switchCategory('color');
  await Studio.facade.updateStudio({adjustments:{brightness:12,contrast:6}});
  await Studio.ui.switchCategory('creative');
  return {
   cacheCount:keys.length,
   hasIndex:!!cachedIndex,
   hasPortrait:!!cachedPortrait,
   cachedLazyCount:cachedLazyChunks.filter(Boolean).length,
   expectedLazyCount:chunkPaths.length,
   tool:Studio.ui.tool
  };
 },lazyChunkPaths);
 await context.setOffline(false);
 page.off('requestfailed',onFailed);
 assert.deepEqual(offlineFailedReqs,[],'Zero failed requests allowed during offline operations');
 assert.ok(offlineCheck.cacheCount>=1);
 assert.equal(offlineCheck.hasIndex,true);
 assert.equal(offlineCheck.hasPortrait,true);
 assert.ok(offlineCheck.expectedLazyCount>=4,'Lazy chunks must be listed in asset-inventory.json');
 assert.equal(offlineCheck.cachedLazyCount,offlineCheck.expectedLazyCount,'All lazy chunks must be precached by Service Worker');
 assert.equal(offlineCheck.tool,'text');
 assert.deepEqual(externalUrls,[],'Zero external font or asset requests allowed');
 assert.deepEqual(errors,[]);

 // 7. Verify V4 Immersive UI, Charcoal palette, compact bottom sheet, unclipped contain canvas & Safari subtool tap
 await page.evaluate(async()=>{
  await Studio.ui.showHome('studio');
  await Studio.facade.openDemo('portrait');
  await Studio.ui.showHome('studio');
 });
 await page.waitForSelector('.v4-hero');
 const v4HomeCheck=await page.evaluate(()=>({
  hasClass:document.body.classList.contains('immersive-v4'),
  themeColor:document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  heroCount:document.querySelectorAll('.v4-hero').length,
  quickCount:document.querySelectorAll('.v4-quick-item').length,
  styleCount:document.querySelectorAll('.v4-style-card').length
 }));
 assert.equal(v4HomeCheck.hasClass,true);
 assert.equal(v4HomeCheck.themeColor,'#fbf9f8');
 assert.equal(v4HomeCheck.heroCount,1);
 assert.equal(v4HomeCheck.quickCount,4);
 assert.ok(v4HomeCheck.styleCount>=6);

 await page.click('[data-v4-launch="filters"]');
 await page.waitForTimeout(360);
 const v4FilterMetrics=await page.evaluate(()=>{
  const shell=document.querySelector('#mobile-shell');
  const sheet=document.querySelector('.mobile-sheet');
  const stage=document.querySelector('#main_wrapper').getBoundingClientRect();
  const canvas=document.querySelector('#canvas_minipaint').getBoundingClientRect();
  return {
   themeColor:document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
   shellBg:getComputedStyle(shell).backgroundColor,
   sheetH:Math.round(sheet.getBoundingClientRect().height),
   unclipped:canvas.top>=stage.top-1&&canvas.bottom<=stage.bottom+1&&canvas.left>=stage.left-1&&canvas.right<=stage.right+1,
   canvasW:Math.round(canvas.width),
   canvasH:Math.round(canvas.height)
  };
 });
 assert.equal(v4FilterMetrics.themeColor,'#19191D');
 assert.equal(v4FilterMetrics.shellBg,'rgb(25, 25, 29)');
 assert.ok(v4FilterMetrics.sheetH>0&&v4FilterMetrics.sheetH<=228,`Compact sheet height ${v4FilterMetrics.sheetH} must fit <= 228px`);
 assert.equal(v4FilterMetrics.unclipped,true,'Portrait canvas must fit completely inside stage without clipping');

 await page.click('[data-v3-subtool="adjust"]');
 await page.waitForTimeout(220);
 const v4AdjustMetrics=await page.evaluate(()=>{
  const canvas=document.querySelector('#canvas_minipaint').getBoundingClientRect();
  return {tool:Studio.ui.tool,canvasW:Math.round(canvas.width),canvasH:Math.round(canvas.height)};
 });
 assert.equal(v4AdjustMetrics.tool,'adjust','Tapping subtool inside sheet header must switch tools in WebKit');
 assert.equal(v4AdjustMetrics.canvasW,v4FilterMetrics.canvasW,'Zero canvas width zoom jump when switching subtools');
 assert.equal(v4AdjustMetrics.canvasH,v4FilterMetrics.canvasH,'Zero canvas height zoom jump when switching subtools');

 // 12. V5 CN Edition Mode (?ui=v5) WebKit Verification across iPhone Viewports
 const v5Viewports=[
  {name:'iPhone 16 Pro Max',width:440,height:956,dpr:3},
  {name:'iPhone 14/15/16',width:390,height:844,dpr:3},
  {name:'iPhone SE/Mini Compact',width:375,height:812,dpr:3}
 ];

 const v5Context=await browser.newContext({
  viewport:{width:440,height:956},
  deviceScaleFactor:3,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
 });
 const v5Page=await v5Context.newPage();
 v5Page.on('pageerror',e=>errors.push(`[V5 PageError] ${e.message}`));
 v5Page.on('console',m=>{if(m.type()==='error')errors.push(`[V5 ConsoleError] ${m.text()}`);});

 await v5Page.goto(`${base}/index.html`,{waitUntil:'networkidle'});
 await v5Page.waitForFunction(()=>window.Studio&&window.StudioReady);
 await v5Page.evaluate(()=>window.StudioReady);
 const releaseVersion=await v5Page.locator('meta[name="app-version"]').getAttribute('content');
 assert.equal(releaseVersion,'5.0.0','Main entrypoint exposes the production release version');

 const v5HomeMetrics=await v5Page.evaluate(async()=>{
  await Studio.ui.showHome('studio');
  const doc=document;
  const top=doc.querySelector('.v5-home-top').getBoundingClientRect();
  const v2TopVisible=getComputedStyle(doc.querySelector('.v2-home-top')).display!=='none';
  const v5TopVisible=getComputedStyle(doc.querySelector('.v5-home-top')).display!=='none';
  const v2NavVisible=getComputedStyle(doc.querySelector('.v2-home-nav')).display!=='none';
  const v5NavVisible=getComputedStyle(doc.querySelector('.v5-home-nav')).display!=='none';
  const navBtns=[...doc.querySelectorAll('.v5-home-nav button')];
  const navBtnHeights=navBtns.map(b=>b.getBoundingClientRect().height);
  const quickItems=[...doc.querySelectorAll('.v5-quick-grid .v5-quick-item')];
  const quickHeights=quickItems.map(q=>q.getBoundingClientRect().height);
  const pills=[...doc.querySelectorAll('.v5-tool-pills .v5-tool-pill')];
  const pillsHeights=pills.map(p=>p.getBoundingClientRect().height);
  return {
   isV5:Studio.ui.isV5,
   bodyClass:doc.body.className,
   themeColor:doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
   headerH:Math.round(top.height),
   v2TopVisible,
   v5TopVisible,
   v2NavVisible,
   v5NavVisible,
   navBtnCount:navBtns.length,
   minNavHeight:Math.min(...navBtnHeights),
   quickCount:quickItems.length,
   minQuickHeight:Math.min(...quickHeights),
   pillCount:pills.length,
   minPillHeight:Math.min(...pillsHeights),
   hasHero:Boolean(doc.querySelector('.v5-hero')),
   heroTitle:doc.querySelector('.v5-hero-title')?.textContent?.trim(),
   hasRecentCard:Boolean(doc.querySelector('.v5-recent-card')),
   hasStyleCard:Boolean(doc.querySelector('.v5-style-card'))
  };
 });

 assert.equal(v5HomeMetrics.isV5,true,'ui.isV5 must be true at the default URL');
 assert.ok(v5HomeMetrics.bodyClass.includes('immersive-v5'),'body must have immersive-v5 class');
 assert.equal(v5HomeMetrics.themeColor,'#141416','Theme color meta tag must be #141416 in V5 Home');
 assert.equal(v5HomeMetrics.v5TopVisible,true,'V5 topbar must be visible');
 assert.equal(v5HomeMetrics.v2TopVisible,false,'Legacy V2/V4 topbar must be hidden');
 assert.equal(v5HomeMetrics.v5NavVisible,true,'V5 5-tab nav must be visible');
 assert.equal(v5HomeMetrics.v2NavVisible,false,'Legacy V2/V4 3-tab nav must be hidden');
 assert.equal(v5HomeMetrics.navBtnCount,5,'V5 bottom nav must contain exactly 5 tabs');
 assert.ok(v5HomeMetrics.minNavHeight>=40,'V5 bottom nav touch targets meet minimum ergonomic height (>= 40px)');
 assert.equal(v5HomeMetrics.quickCount,4,'V5 quick grid must contain 4 items (Beauty, Makeup, Body, Filters)');
 assert.ok(v5HomeMetrics.minQuickHeight>=70,'V5 quick grid items meet ergonomic height');
 assert.equal(v5HomeMetrics.pillCount,6,'V5 secondary utility strip has 6 items');
 assert.ok(v5HomeMetrics.minPillHeight>=36,'V5 secondary pills meet ergonomic touch height');
 assert.equal(v5HomeMetrics.hasHero,true,'V5 Hero banner must be present');
 assert.ok(v5HomeMetrics.heroTitle.includes('Chỉnh ảnh'),'V5 Hero banner title matches spec');

 await v5Page.click('.v5-quick-grid [data-v4-launch="beauty"]');
 await v5Page.waitForTimeout(300);

 const v5EditorMetrics=await v5Page.evaluate(()=>{
  const doc=document;
  const stage=doc.querySelector('#studio-stage').getBoundingClientRect();
  const canvas=doc.querySelector('#canvas_minipaint').getBoundingClientRect();
  const sheet=doc.querySelector('#studio-inspector').getBoundingClientRect();
  return {
   tool:Studio.ui.tool,
   themeColor:doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
   compactDockTarget:Studio.ui.sheet.stops().compact,
   sheetH:Math.round(sheet.height),
   canvasW:Math.round(canvas.width),
   canvasH:Math.round(canvas.height),
   unclipped:canvas.top>=stage.top-1&&canvas.bottom<=stage.bottom+1&&canvas.left>=stage.left-1&&canvas.right<=stage.right+1
  };
 });

 assert.equal(v5EditorMetrics.tool,'beauty','Launched beauty tool in V5 editor');
 assert.equal(v5EditorMetrics.themeColor,'#141416','Theme color in V5 Editor remains #141416');
 assert.equal(v5EditorMetrics.compactDockTarget,196,'V5 compact dock target is 196px');
 assert.ok(v5EditorMetrics.sheetH>=180&&v5EditorMetrics.sheetH<=210,`V5 sheet height ${v5EditorMetrics.sheetH}px fits ~196px compact dock`);
 assert.equal(v5EditorMetrics.unclipped,true,'Canvas fits cleanly inside stage without clipping in V5');

 await v5Page.click('.sheet-confirm');
 await v5Page.waitForTimeout(180);
 await v5Page.click('#mobile-nav [data-v3-category="body"]');
 await v5Page.waitForTimeout(220);
 const v5ReshapeMetrics=await v5Page.evaluate(()=>{
  const canvas=document.querySelector('#canvas_minipaint').getBoundingClientRect();
  return {tool:Studio.ui.tool,canvasW:Math.round(canvas.width),canvasH:Math.round(canvas.height)};
 });
 assert.equal(v5ReshapeMetrics.tool,'reshape','Switched to face reshape subtool');
 assert.equal(v5ReshapeMetrics.canvasW,v5EditorMetrics.canvasW,'Zero width zoom jump in V5 subtool switch');
 assert.equal(v5ReshapeMetrics.canvasH,v5EditorMetrics.canvasH,'Zero height zoom jump in V5 subtool switch');

 for(const vp of v5Viewports.slice(1)){
  await v5Page.setViewportSize({width:vp.width,height:vp.height});
  await v5Page.evaluate(async()=>{ await Studio.facade.fit(); });
  await v5Page.waitForTimeout(150);
  const vpMetrics=await v5Page.evaluate(()=>{
   const doc=document;
   const stage=doc.querySelector('#studio-stage').getBoundingClientRect();
   const canvas=doc.querySelector('#canvas_minipaint').getBoundingClientRect();
   return {
    scrollW:doc.documentElement.scrollWidth,
    clientW:doc.documentElement.clientWidth,
    unclipped:canvas.top>=stage.top-1&&canvas.bottom<=stage.bottom+1&&canvas.left>=stage.left-1&&canvas.right<=stage.right+1
   };
  });
  assert.equal(vpMetrics.scrollW<=vpMetrics.clientW,true,`No horizontal overflow on ${vp.name}`);
  assert.equal(vpMetrics.unclipped,true,`Canvas stays unclipped on ${vp.name}`);
 }

 await v5Context.close();

 if(process.env.WRITE_BENCHMARK==='1'){
  await mkdir(resolve(root,'docs/qa'),{recursive:true});
  const distFiles=await readdir(dist);
  const entryFile=distFiles.find(f=>/^studio\.[a-f0-9]{12}\.js$/.test(f));
  const entryStats=entryFile?await stat(resolve(dist,entryFile)):null;
  const afterBootstrapEntrypointKiB=entryStats?Number((entryStats.size/1024).toFixed(2)):null;
  const benchmarkData={
   timestamp:new Date().toISOString(),
   environment:{
    browser:`Playwright WebKit ${browser.version()}`,
    deviceProfile:'iPhone 16 Pro Max (440x956 CSS px, DPR 3, Touch/Mobile)',
    hardwareNote:'Automated Playwright WebKit emulation on Windows 11 x64 workstation (NOT physical iPhone 16 Pro Max hardware)',
    os:process.platform+' '+process.arch,
    node:process.version
   },
   bundleOptimization:{
    beforeMainEntrypointKiB:1812.5,
    afterBootstrapEntrypointKiB,
    lazyChunksVerified:['studio-makeup','studio-creative','studio-lut','studio-fx','legacy-open'],
    prematureLazyChunksAtStartup:bootState.prematureLazy.length,
    externalNetworkRequests:externalUrls.length
   },
   gpuLiquifyAccuracy:{
    strengthZeroMaxDiff:gpuAccuracyAndBench.zeroMaxDiff,
    outsideRadiusMaxDiff:gpuAccuracyAndBench.outsideDiff,
    combinedPushPinchBulgeRestoreFreezePerspectiveAlpha:{
     maxChannelDiffLSB:gpuAccuracyAndBench.fullMaxDiff,
     meanAbsDiffLSB:gpuAccuracyAndBench.fullMeanAbsDiff,
     exactMatchRatio:gpuAccuracyAndBench.fullExactMatchRatio
    }
   },
   gpuVsCpuLiquifyBenchmark:{
    strokeCount:8,
    preview_1280x1024_1_3MP:gpuAccuracyAndBench.bench13MP,
    highRes_2560x2048_5_2MP:gpuAccuracyAndBench.bench52MP
   },
   photoOperationsMs:{
    appBootAndRestoreMs:bootMs,
    openPngAlphaMs:editResult.openPngMs,
    openDemoJpegMs:editResult.openJpgMs,
    exportPreviewJpegMs:editResult.exportJpgMs,
    exportPreviewPngMs:editResult.exportPngMs,
    photo12MP_4000x3000:{
     openAndPreviewMs:lifecycleAnd12MP.open12Ms,
     gpuLiquifyAndGradePreviewMs:lifecycleAnd12MP.liquifyPreview12Ms,
     tiledExport12MPJpegMs:lifecycleAnd12MP.export12Ms,
     exportedBytes:lifecycleAnd12MP.export12Bytes
    }
   },
   memoryAndResilience:{
    backgroundTrimTrackedCanvases:lifecycleAnd12MP.trackedAfterHidden,
    webglContextLossFallbackBackend:fallbackCheck.backendDuringLoss,
    webglContextRestoreBackend:fallbackCheck.backendAfterRestore,
    webglStats:lifecycleAnd12MP.webglStats
   }
  };
  await writeFile(resolve(root,'docs/qa/v3-gpu-benchmark.json'),JSON.stringify(benchmarkData,null,2)+'\n','utf8');
 }

 console.log(`WebKit iPhone 16 Pro Max full V3 & GPU Liquify QA passed (${browser.version()}): WebGL2 Liquify (${gpuAccuracyAndBench.bench52MP.gpuMs}ms GPU vs ${gpuAccuracyAndBench.bench52MP.cpuMs}ms CPU @ 5.2MP, maxDiff=${gpuAccuracyAndBench.fullMaxDiff}), Context Loss Fallback, 12MP Open/Export (${lifecycleAnd12MP.open12Ms}ms / ${lifecycleAnd12MP.export12Ms}ms), Lazy Chunks, Offline.`);
}finally{
 await browser?.close();
 server.close();
}
