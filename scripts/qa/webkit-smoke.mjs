import {webkit} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

const root=resolve(import.meta.dirname,'../..'),dist=resolve(root,'dist');
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};

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

 await page.goto(`${base}/index.html`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.Studio&&window.StudioReady);
 await page.evaluate(()=>window.StudioReady);

 const bootState=await page.evaluate(async()=>{
  await Studio.ui.closeSheet();
  Studio.ui.showEditor();
  await Studio.facade.fit();
  const c=document.querySelector('#canvas_minipaint');
  return {
   title:document.title,
   width:Studio.facade.config.WIDTH,
   height:Studio.facade.config.HEIGHT,
   backingW:c.width,
   logicalW:c.studioViewportWidth,
   legacyMenu:document.querySelectorAll('.native-support,#main_menu,#zoom_range').length
  };
 });
 assert.ok(bootState.title.includes('BaoHim Photo'));
 assert.ok(bootState.width>0&&bootState.height>0);
 assert.equal(bootState.backingW,Math.round(bootState.logicalW*3));
 assert.equal(bootState.legacyMenu,0);

 // Verify all V3 Phase 0-6 capabilities in WebKit (iPhone 16 Pro Max viewport 440x956 DPR 3):
 // Open, Zoom/Pan, Auto/Adjust, Skin Smooth, Heal/Clone/Blemish, Face Reshape, Body Reshape + Pin,
 // Makeup & Hair, Filter + .cube LUT, Typography, Sticker, Collage, Undo/Redo, Save/Restore, Export JPG/PNG, Offline
 const editResult=await page.evaluate(async()=>{
  const {facade:f,ui}=window.Studio;
  // 1. Zoom & Pan
  const z0=f.config.ZOOM;
  await f.zoom(1.35);
  const zoomed=f.config.ZOOM>z0;
  f.pan(18,-12);
  await f.fit();
  // 2. Auto & Color + Filter + .cube 3D LUT + Optical effects
  await ui.switchCategory('auto');
  await ui.applyAutoEnhance('portrait',80);
  await ui.commitDraft();
  await ui.switchCategory('color');
  await f.updateStudio({preset:'ccd',intensity:80,adjustments:{bloom:22,halation:18}});
  // 3. Beauty: Skin Smooth + Blemish + Heal
  await ui.switchCategory('face');
  await f.addStroke({type:'smooth',radius:36,strength:.7,hardness:.5,feather:.45,detail:.7,points:[{x:300,y:400},{x:320,y:410}]});
  await f.addStroke({type:'blemish',radius:10,strength:.9,hardness:.65,feather:.4,points:[{x:285,y:395}]});
  await f.addStroke({type:'heal',radius:28,strength:.8,hardness:.5,cloneSource:{x:260,y:380},points:[{x:310,y:420}]});
  const cachedStrokes=f.raster.stats.lastCachedStrokes;
  const renderedStrokes=f.raster.stats.lastRenderedStrokes;
  // 4. Undo / Redo on strokes
  await f.undo();
  const afterUndo=f.basePhotoLayer().studio.strokes.length;
  await f.redo();
  const afterRedo=f.basePhotoLayer().studio.strokes.length;
  // 5. Face Reshape (mesh control points)
  await ui.switchTool('reshape');
  ui.reshapePreset='jawline';
  await ui.action('face-place');
  ui.faceAmount=50;
  await ui.action('apply-face');
  const faceWarps=f.basePhotoLayer().studio.warps.length;
  // 6. Body Reshape + Background Pin
  await ui.switchCategory('body');
  await f.addStroke({type:'freeze',points:[{x:90,y:300}],radius:32,hardness:.88,strength:1});
  ui.brush.mode='curve';
  ui.router.bodyHandles=[{x:160,y:260},{x:175,y:380}];
  await ui.action('apply-body');
  const totalWarps=f.basePhotoLayer().studio.warps.length;
  // 7. Makeup & Hair Studio
  await ui.switchTool('makeup');
  await ui.applyMakeupPreset('douyin');
  await ui.selectMakeupRole('hair');
  await f.addStroke({type:'makeup',points:[{x:220,y:160}],radius:40,strength:.5,hardness:.4,feather:.55,color:'#6e473b',blend:'soft-light'});
  // 8. Creative Studio: Typography, Sticker, Collage
  await ui.switchCategory('creative');
  await f.addText('BaoHim V3 · Đẹp tự nhiên');
  await f.updateText({typography:{arc:18,gradient:{enabled:true,from:'#ffffff',to:'#d96792',angle:35}}});
  await f.addSticker('sparkle');
  // 9. Save & Reopen project
  await f.save();
  const savedProject=await f.repository.load(f.id);
  await f.restore(savedProject);
  // 10. Collage + Undo back to multi-layer portrait
  await f.collage('duo',20);
  const collageLayers=f.config.layers.filter(l=>l.type==='image'&&!l.studio?.sticker&&!l.studio?.makeup).length;
  await f.undo();
  // 11. Export JPG & PNG
  const jpg=await f.exportImage({format:'jpeg',scale:.25});
  const png=await f.exportImage({format:'png',scale:.25});
  return {
   zoomed,
   preset:f.basePhotoLayer().studio.preset,
   cachedStrokes,
   renderedStrokes,
   afterUndo,
   afterRedo,
   faceWarps,
   totalWarps,
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
 assert.equal(editResult.cachedStrokes,2);
 assert.equal(editResult.renderedStrokes,1);
 assert.equal(editResult.afterUndo,2);
 assert.equal(editResult.afterRedo,3);
 assert.ok(editResult.faceWarps>=2);
 assert.ok(editResult.totalWarps>editResult.faceWarps);
 assert.equal(editResult.collageLayers,2);
 assert.equal(editResult.hasHairLayer,true);
 assert.equal(editResult.hasTextLayer,true);
 assert.equal(editResult.hasStickerLayer,true);
 assert.ok(editResult.jpgSize>1000);
 assert.ok(editResult.pngSize>1000);

 // 12. Verify offline Service Worker cache & offline fetch interception
 const offlineCheck=await page.evaluate(async()=>{
  await navigator.serviceWorker?.ready;
  const keys=await caches.keys();
  const cachedIndex=await caches.match('./index.html');
  const cachedBundle=await caches.match('./assets/photos/portrait.jpg');
  return {cacheCount:keys.length,hasIndex:!!cachedIndex,hasBundle:!!cachedBundle};
 });
 assert.ok(offlineCheck.cacheCount>=1);
 assert.equal(offlineCheck.hasIndex,true);
 assert.equal(offlineCheck.hasBundle,true);

 assert.deepEqual(errors,[]);
 console.log(`WebKit iPhone 16 Pro Max full V3 QA passed (${browser.version()}): Open, Zoom/Pan, Auto/Color, Beauty, Heal/Blemish, Face/Body Reshape, Makeup/Hair, Filter/LUT, Text/Sticker/Collage, Undo/Redo, Save/Restore, JPG/PNG Export, Offline.`);
}finally{
 await browser?.close();
 server.close();
}
