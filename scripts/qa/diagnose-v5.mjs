import {webkit} from 'playwright';
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

let browser;
try{
 browser=await webkit.launch({headless:true});
 const page=await browser.newPage({
  viewport:{width:440,height:956},
  deviceScaleFactor:3,
  isMobile:true,
  hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
 });

 await page.goto(`${base}/index.html?ui=v5`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.Studio&&window.StudioReady);
 await page.evaluate(()=>window.StudioReady);

 const diagResults=await page.evaluate(async()=>{
  const res={home:{},filters:{},makeup:{},reshape:{}};
  const d=document;

  // 1. Home diagnostics
  res.home.vipInDOM=!!d.querySelector('.v5-top-vip');
  res.home.bellInDOM=!!d.querySelector('button[aria-label="Thông báo"]');
  res.home.editorHeaderInert=d.querySelector('.mobile-header')?.inert;
  res.home.editorMiddleInert=d.querySelector('#middle_area')?.inert;
  res.home.editorInspectorInert=d.querySelector('#studio-inspector')?.inert;
  res.home.editorNavInert=d.querySelector('#mobile-nav')?.inert;

  // Check header CSS
  const grabber=d.querySelector('.sheet-grabber');
  const panelHeading=d.querySelector('.mobile-panel-heading');
  res.headerDebug={
   dragZoneHeight:d.querySelector('#sheet-drag-zone')?.offsetHeight,
   grabberHeight:grabber?.offsetHeight,
   panelHeaderHeight:d.querySelector('#panel-header')?.offsetHeight,
   headingHeight:panelHeading?.offsetHeight,
   dragZoneStyle:getComputedStyle(d.querySelector('#sheet-drag-zone')).height,
   gridRows:getComputedStyle(d.querySelector('#studio-inspector')).gridTemplateRows
  };

  // Click demo to enter editor
  await Studio.facade.openDemo('portrait');
  await Studio.ui.closeSheet();
  Studio.ui.showEditor();
  await Studio.facade.fit();

  res.editorEntered={
   editorHeaderInert:d.querySelector('.mobile-header')?.inert,
   editorMiddleInert:d.querySelector('#middle_area')?.inert,
   editorInspectorInert:d.querySelector('#studio-inspector')?.inert,
   editorNavInert:d.querySelector('#mobile-nav')?.inert
  };

  const getElementMetrics=(el)=>{
   if(!el)return null;
   const r=el.getBoundingClientRect();
   return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right};
  };

  // 2. Filter diagnostics
  await Studio.ui.switchTool('filters');
  await new Promise(r=>setTimeout(r,350));
  const sheet=d.querySelector('#studio-inspector');
  const header=d.querySelector('#sheet-drag-zone');
  const content=d.querySelector('#panel-content');
  const footer=d.querySelector('#panel-footer');
  const confirmBtn=d.querySelector('#panel-footer .sheet-confirm');
  const categoryRow=content.querySelector('.v2-tabs');
  const filterSlider=content.querySelector('.slider-field input[type="range"]');

  const contentRect=content.getBoundingClientRect();
  const catRect=categoryRow?.getBoundingClientRect();
  const footerRect=footer.getBoundingClientRect();

  // Hit test category tab center
  let catHit=null;
  if(catRect){
   const hitEl=d.elementFromPoint(catRect.left+20,catRect.top+catRect.height/2);
   catHit=hitEl?hitEl.tagName+' .'+hitEl.className:null;
  }

  res.filters={
   detent:sheet.dataset.detent,
   sheetRect:getElementMetrics(sheet),
   headerRect:getElementMetrics(header),
   contentRect:getElementMetrics(content),
   footerRect:getElementMetrics(footer),
   confirmRect:getElementMetrics(confirmBtn),
   catRect,
   catHit,
   categoryClippedByFooter:catRect?(catRect.bottom>footerRect.top):null,
   contentScrollHeight:content.scrollHeight,
   contentClientHeight:content.clientHeight
  };

  // 3. Makeup diagnostics: select lips -> velvet (Đỏ rượu)
  await Studio.ui.switchTool('makeup');
  await Studio.ui.selectMakeupRole('lips');
  const velvetBtn=content.querySelector('[data-v2-makeup-preset="velvet"]');
  if(velvetBtn)velvetBtn.click();
  await new Promise(r=>setTimeout(r,50));

  const makeupRange=content.querySelector('.v2-brush-controls input[type="range"]');
  const makeupOutput=content.querySelector('.v2-brush-controls .slider-heading output');
  const mField=makeupRange?.closest('.slider-field');
  const mRangeRect=makeupRange?.getBoundingClientRect();
  const mOutRect=makeupOutput?.getBoundingClientRect();
  const mFieldRect=mField?.getBoundingClientRect();
  const mContentRect=content.getBoundingClientRect();

  const mSliders=[...content.querySelectorAll('.slider-field')].map(f=>({
   label:f.querySelector('.slider-heading')?.textContent,
   fieldRect:getElementMetrics(f),
   headingRect:getElementMetrics(f.querySelector('.slider-heading')),
   rangeRect:getElementMetrics(f.querySelector('input[type="range"]')),
   outputRect:getElementMetrics(f.querySelector('output'))
  }));

  res.makeup={
   sliders:mSliders,
   contentRect:getElementMetrics(content),
   contentScrollHeight:content.scrollHeight,
   contentClientHeight:content.clientHeight
  };

  // 4. Reshape diagnostics: select face -> preset face (Gọn mặt)
  await Studio.ui.switchTool('reshape');
  const gonMatBtn=content.querySelector('[data-v2-reshape-preset="face"]');
  if(gonMatBtn)gonMatBtn.click();
  await new Promise(r=>setTimeout(r,50));

  const reshapeRange=content.querySelector('.v2-brush-controls input[type="range"]');
  const reshapeOutput=content.querySelector('.v2-brush-controls .slider-heading output');
  const rRangeRect=reshapeRange?.getBoundingClientRect();
  const rOutRect=reshapeOutput?.getBoundingClientRect();
  const rContentRect=content.getBoundingClientRect();

  res.reshape={
   rangeRect:rRangeRect,
   outputRect:rOutRect,
   contentRect:getElementMetrics(content),
   outputVisible:rOutRect?(rOutRect.top>=rContentRect.top&&rOutRect.bottom<=rContentRect.bottom):false,
   rangeVisible:rRangeRect?(rRangeRect.top>=rContentRect.top&&rRangeRect.bottom<=rContentRect.bottom):false,
   contentScrollHeight:content.scrollHeight,
   contentClientHeight:content.clientHeight
  };

  return res;
 });

 console.log(JSON.stringify(diagResults,null,2));
}finally{
 await browser?.close();
 server.close();
}
