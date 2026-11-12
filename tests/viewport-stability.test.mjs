import {test} from 'node:test';
import assert from 'node:assert/strict';
import view from '../src/js/libs/zoomView.js';
import {MobileViewport} from '../src/js/studio/mobile-viewport.mjs';

function setupViewportHarness({docW=1200,docH=1500,winW=440,winH=956,stageW=440,stageH=750,dpr=3}={}){
 const listeners=new Map(),rafQueue=[],roCallbacks=[],viewportEvents=[];
 let rectLeft=0,rectTop=0;
 const stage={clientWidth:stageW,clientHeight:stageH};
 const ctx={canvas:null,setTransform(){}};
 const canvas={
  width:stageW*dpr,height:stageH*dpr,studioViewportWidth:stageW,studioViewportHeight:stageH,studioPixelRatio:dpr,
  style:{setProperty(){}},
  getContext:()=>ctx,
  getBoundingClientRect(){
   const w=this.studioViewportWidth||this.width,h=this.studioViewportHeight||this.height;
   return {left:rectLeft,top:rectTop,width:w,height:h,right:rectLeft+w,bottom:rectTop+h};
  }
 };
 ctx.canvas=canvas;
 const origGlobals={
  document:globalThis.document,
  ResizeObserver:globalThis.ResizeObserver,
  requestAnimationFrame:globalThis.requestAnimationFrame,
  cancelAnimationFrame:globalThis.cancelAnimationFrame,
  innerWidth:globalThis.innerWidth,
  innerHeight:globalThis.innerHeight,
  devicePixelRatio:globalThis.devicePixelRatio,
  visualViewport:globalThis.visualViewport,
  addEventListener:globalThis.addEventListener,
  removeEventListener:globalThis.removeEventListener
 };
 globalThis.document={getElementById:id=>id==='main_wrapper'?stage:id==='canvas_minipaint'?canvas:null};
 globalThis.ResizeObserver=class{constructor(cb){roCallbacks.push(cb);}observe(){}disconnect(){}};
 globalThis.requestAnimationFrame=cb=>{const id=rafQueue.length+1;rafQueue.push({id,cb});return id;};
 globalThis.cancelAnimationFrame=id=>{const entry=rafQueue.find(r=>r.id===id);if(entry)entry.cancelled=true;};
 const addFn=(target,type,fn)=>{if(!listeners.has(target))listeners.set(target,new Map());const m=listeners.get(target);if(!m.has(type))m.set(type,new Set());m.get(type).add(fn);};
 const remFn=(target,type,fn)=>listeners.get(target)?.get(type)?.delete(fn);
 globalThis.innerWidth=winW;globalThis.innerHeight=winH;globalThis.devicePixelRatio=dpr;
 globalThis.addEventListener=(type,fn)=>addFn('window',type,fn);
 globalThis.removeEventListener=(type,fn)=>remFn('window',type,fn);
 globalThis.visualViewport={width:winW,height:winH,offsetTop:0,addEventListener:(t,fn)=>addFn('vv',t,fn),removeEventListener:(t,fn)=>remFn('vv',t,fn)};

 const config={WIDTH:docW,HEIGHT:docH,ZOOM:1,need_render:false,visible_width:stageW,visible_height:stageH};
 const gui={
  prepareCount:0,
  prepare_canvas(){
   this.prepareCount++;
   const w=Math.min(Math.ceil(config.WIDTH*config.ZOOM),stage.clientWidth);
   const h=Math.min(Math.ceil(config.HEIGHT*config.ZOOM),stage.clientHeight);
   rectLeft=(stage.clientWidth-w)/2;rectTop=(stage.clientHeight-h)/2;
   canvas.studioViewportWidth=w;canvas.studioViewportHeight=h;canvas.studioPixelRatio=globalThis.devicePixelRatio||1;
   canvas.width=Math.max(1,Math.round(w*canvas.studioPixelRatio));canvas.height=Math.max(1,Math.round(h*canvas.studioPixelRatio));
   config.visible_width=w;config.visible_height=h;
  },
  check_canvas_offset(){}
 };
 const app={Config:config,GUI:gui,Layers:{ctx,last_zoom:1,stable_dimensions:[docW,docH]}};
 const facade={app,config,pan:(dx,dy)=>{view.move(dx,dy);},emit:type=>{if(type==='viewport')viewportEvents.push(config.ZOOM);}};
 addFn('window','resize',()=>{gui.prepare_canvas();config.need_render=true;});

 const viewport=new MobileViewport(facade);
 async function flushRaf(){
  let guard=0;
  while(rafQueue.some(r=>!r.cancelled)&&guard++<20){
   const batch=rafQueue.splice(0,rafQueue.length);
   for(const item of batch)if(!item.cancelled)item.cb();
   await Promise.resolve();
  }
 }
 function fire(target,type){
  for(const fn of listeners.get(target)?.get(type)||[])fn();
 }
 function triggerStageResize(nextW,nextH,{winWidth,winHeight,vvHeight,fireWindowResize=false,fireVV=false}={}){
  if(winWidth!==undefined)globalThis.innerWidth=winWidth;
  if(winHeight!==undefined)globalThis.innerHeight=winHeight;
  if(vvHeight!==undefined)globalThis.visualViewport.height=vvHeight;
  stage.clientWidth=nextW;stage.clientHeight=nextH;
  for(const cb of roCallbacks)cb();
  if(fireWindowResize)fire('window','resize');
  if(fireVV)fire('vv','resize');
 }
 function worldAtCenter(){
  const w=canvas.studioViewportWidth,h=canvas.studioViewportHeight;
  return view.toWorld(w/2,h/2);
 }
 function cleanup(){
  viewport.destroy();
  Object.assign(globalThis,origGlobals);
 }
 return {facade,viewport,config,gui,canvas,stage,flushRaf,triggerStageResize,fire,worldAtCenter,viewportEvents,cleanup};
}

test('MobileViewport distinguishes Fit mode (unclipped on resize, invariant across tools) from Manual mode (locked zoom & center)',async()=>{
 const h=setupViewportHarness({docW:1000,docH:1500,stageW:440,stageH:814});
 try{
  await h.facade.fit();
  const homeFitZoom=h.config.ZOOM;
  assert.ok(homeFitZoom>0&&homeFitZoom<1);
  assert.equal(h.viewport.fitted,true);

  // 1000x1500 opening Filter compact toolbar (198px -> stage 440x656): still width-bound, same zoom, 100% unclipped
  h.triggerStageResize(440,656);
  await h.flushRaf();
  assert.equal(h.config.ZOOM,homeFitZoom);
  assert.ok(h.config.HEIGHT*h.config.ZOOM<=h.stage.clientHeight);
  assert.equal(h.canvas.studioViewportHeight,Math.ceil(1500*homeFitZoom));

  // 1. Switch across 30 tools using shared compact height (440x656) -> zero zoom drift
  for(let i=0;i<30;i++){
   h.triggerStageResize(440,656);
   await h.flushRaf();
   assert.equal(h.config.ZOOM,homeFitZoom,`Zoom drifted on switch #${i+1}`);
  }

  // Tall full-body photo 1000x2000 in Fit mode refits cleanly when compact sheet opens so head/feet stay unclipped
  h.config.WIDTH=1000;h.config.HEIGHT=2000;
  h.triggerStageResize(440,814);
  await h.facade.fit();
  assert.ok(2000*h.config.ZOOM<=814);
  h.triggerStageResize(440,656);
  await h.flushRaf();
  assert.ok(2000*h.config.ZOOM<=656,'Full-body 1000x2000 must stay 100% visible when toolbar opens');
  assert.equal(h.canvas.studioViewportHeight,Math.ceil(2000*h.config.ZOOM));

  // Restore 1000x1500 at compact stage before Manual 200% zoom
  h.config.WIDTH=1000;h.config.HEIGHT=1500;
  h.triggerStageResize(440,656);
  await h.facade.fit();
  const fitZoom=h.config.ZOOM;

  // 2. Manual zoom to 200% and pan to a specific off-center face detail
  await h.facade.zoom(2/h.config.ZOOM);
  assert.equal(h.config.ZOOM,2);
  assert.equal(h.viewport.fitted,false);
  h.facade.pan(180,-240);
  const anchorBefore=h.worldAtCenter();
  assert.equal(h.gui.canvasWidth,undefined);

  // 3. Switch 10 tools + drag sheet across compact/peek/expanded/closed + keyboard + Safari bar resize
  const events=[
   [440,656,{}],
   [440,656,{}],
   [440,814,{}],
   [440,380,{}],
   [440,870,{}],
   [440,660,{winHeight:840,vvHeight:840,fireWindowResize:true,fireVV:true}], // Safari bar expand
   [440,420,{vvHeight:500,fireWindowResize:true,fireVV:true}], // Keyboard visible
   [440,750,{winHeight:956,vvHeight:956,fireWindowResize:true,fireVV:true}]
  ];
  for(const [w,ht,opts] of events){
   h.triggerStageResize(w,ht,opts);
   await h.flushRaf();
   assert.equal(h.config.ZOOM,2,'Manual 200% zoom must remain locked');
   assert.ok(Math.abs(view.scale-2)<1e-6,'view.scale must remain 2.0');
   assert.equal(h.canvas.width,Math.round(h.canvas.studioViewportWidth*3),'DPR=3 backing width must stay synced');
   const after=h.worldAtCenter();
   assert.ok(Math.abs(after.x-anchorBefore.x)<0.5,`World X center drifted: ${after.x} vs ${anchorBefore.x}`);
   assert.ok(Math.abs(after.y-anchorBefore.y)<0.5,`World Y center drifted: ${after.y} vs ${anchorBefore.y}`);
  }

  // 4. Orientation rotation while manually zoomed (440x956 -> 956x440) preserves 200% zoom and center anchor
  h.triggerStageResize(956,310,{winWidth:956,winHeight:440,vvHeight:440,fireWindowResize:true,fireVV:true});
  h.fire('window','orientationchange');
  await h.flushRaf();
  assert.equal(h.config.ZOOM,2);
  const rotatedCenter=h.worldAtCenter();
  assert.ok(Math.abs(rotatedCenter.x-anchorBefore.x)<0.5);
  assert.ok(Math.abs(rotatedCenter.y-anchorBefore.y)<0.5);

  // 5. Explicit "Vừa khung" (fit) resets zoom cleanly to contain current viewport
  await h.facade.fit();
  assert.equal(h.viewport.fitted,true);
  assert.ok(h.config.ZOOM<0.3);

  // 6. Rotation when fitted re-fits cleanly to portrait
  h.triggerStageResize(440,656,{winWidth:440,winHeight:956,vvHeight:956,fireWindowResize:true,fireVV:true});
  h.fire('window','orientationchange');
  await h.flushRaf();
  assert.equal(h.viewport.fitted,true);
  assert.ok(Math.abs(h.config.ZOOM-fitZoom)<1e-9);
 }finally{
  h.cleanup();
 }
});
