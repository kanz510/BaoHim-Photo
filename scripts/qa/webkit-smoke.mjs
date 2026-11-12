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

 // Verify filter, beauty stroke with ROI cache, undo/redo, and export in WebKit engine
 const editResult=await page.evaluate(async()=>{
  const f=Studio.facade;
  await f.updateStudio({preset:'rose',intensity:75});
  await f.addStroke({type:'smooth',radius:36,strength:.7,hardness:.5,points:[{x:300,y:400},{x:320,y:410}]});
  await f.addStroke({type:'heal',radius:28,strength:.8,hardness:.5,cloneSource:{x:260,y:380},points:[{x:310,y:420}]});
  const cachedStrokes=f.raster.stats.lastCachedStrokes;
  const renderedStrokes=f.raster.stats.lastRenderedStrokes;
  await f.undo();
  const afterUndo=f.basePhotoLayer().studio.strokes.length;
  await f.redo();
  const afterRedo=f.basePhotoLayer().studio.strokes.length;
  const jpg=await f.exportImage({format:'jpeg',scale:.25});
  const png=await f.exportImage({format:'png',scale:.25});
  return {
   preset:f.basePhotoLayer().studio.preset,
   cachedStrokes,
   renderedStrokes,
   afterUndo,
   afterRedo,
   jpgSize:jpg.size,
   pngSize:png.size
  };
 });
 assert.equal(editResult.preset,'rose');
 assert.equal(editResult.cachedStrokes,1);
 assert.equal(editResult.renderedStrokes,1);
 assert.equal(editResult.afterUndo,1);
 assert.equal(editResult.afterRedo,2);
 assert.ok(editResult.jpgSize>1000);
 assert.ok(editResult.pngSize>1000);
 assert.deepEqual(errors,[]);
 console.log(`WebKit iPhone 16 Pro Max smoke passed (${browser.version()}): DPR3 fit, ROI stroke cache, undo/redo, JPG/PNG export.`);
}finally{
 await browser?.close();
 server.close();
}
