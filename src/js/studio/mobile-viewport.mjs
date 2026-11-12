import view from '../libs/zoomView.js';
import {containScale} from './mobile-layout.mjs';

export class MobileViewport{
 constructor(facade){
  this.f=facade;this.fitted=true;this.lastSize='';this.pending=0;this.syncing=false;
  this.canvasWidth=0;this.canvasHeight=0;this.canvasRatio=0;this.docSize='';
  this.viewportWidth=globalThis.innerWidth||0;this.viewportPortrait=(globalThis.innerWidth||0)<=(globalThis.innerHeight||0);
  this.orientationPending=false;
  this.stage=document.getElementById('main_wrapper');this.canvas=document.getElementById('canvas_minipaint');
  facade.fit=()=>this.fit();facade.zoom=factor=>this.zoom(factor);
  const pan=facade.pan?.bind(facade);
  facade.pan=(dx,dy)=>{if(pan)pan(dx,dy);if(dx||dy)this.fitted=false;};
  const gui=facade.app?.GUI;
  if(gui?.prepare_canvas){
   const origPrepare=gui.prepare_canvas.bind(gui);
   gui.prepare_canvas=()=>{
    if(this.syncing){origPrepare();return;}
    const c=this.f.config,sameDoc=`${c.WIDTH}:${c.HEIGHT}`===this.docSize;
    const snap=sameDoc&&this.canvasWidth>0?this.captureWorldCenter():null;
    origPrepare();
    if(snap)this.restoreWorldCenter(snap);
    this.captureCanvasState();
   };
  }
  this.onResize=()=>this.schedule();
  this.onOrientation=()=>{this.orientationPending=true;this.schedule();};
  if(globalThis.ResizeObserver&&this.stage){this.observer=new ResizeObserver(this.onResize);this.observer.observe(this.stage);}
  globalThis.addEventListener?.('resize',this.onResize,{passive:true});
  globalThis.addEventListener?.('orientationchange',this.onOrientation,{passive:true});
  globalThis.visualViewport?.addEventListener('resize',this.onResize,{passive:true});
 }
 destroy(){
  if(this.pending){cancelAnimationFrame(this.pending);this.pending=0;}
  this.observer?.disconnect();
  globalThis.removeEventListener?.('resize',this.onResize);
  globalThis.removeEventListener?.('orientationchange',this.onOrientation);
  globalThis.visualViewport?.removeEventListener('resize',this.onResize);
 }
 captureWorldCenter(){
  const c=this.f.config,scale=c.ZOOM||view.scale||1;
  const w=this.canvasWidth||this.canvas?.studioViewportWidth||this.canvas?.width||0;
  const h=this.canvasHeight||this.canvas?.studioViewportHeight||this.canvas?.height||0;
  return {scale,cx:w>0?(w/2-view.x)/scale:c.WIDTH/2,cy:h>0?(h/2-view.y)/scale:c.HEIGHT/2};
 }
 restoreWorldCenter(snap){
  if(!snap||!this.canvas)return;
  const c=this.f.config,nextW=this.canvas.studioViewportWidth??this.canvas.width,nextH=this.canvas.studioViewportHeight??this.canvas.height;
  view.setBounds(0,0,c.WIDTH,c.HEIGHT);view.setContext(this.f.app.Layers.ctx);
  view.scale=snap.scale;view.x=nextW/2-snap.cx*snap.scale;view.y=nextH/2-snap.cy*snap.scale;view.update();
  c.ZOOM=snap.scale;this.f.app.Layers.last_zoom=snap.scale;this.f.app.Layers.stable_dimensions=[c.WIDTH,c.HEIGHT];
  c.need_render=true;this.f.app.GUI.check_canvas_offset?.();
 }
 captureCanvasState(){
  const c=this.f.config;
  this.canvasWidth=this.canvas?.studioViewportWidth??this.canvas?.width??0;
  this.canvasHeight=this.canvas?.studioViewportHeight??this.canvas?.height??0;
  this.canvasRatio=this.canvas?.studioPixelRatio||1;
  this.lastSize=`${this.stage?.clientWidth||0}:${this.stage?.clientHeight||0}`;
  this.docSize=`${c.WIDTH}:${c.HEIGHT}`;
 }
 captureViewportMetrics(){
  if(globalThis.innerWidth){this.viewportWidth=globalThis.innerWidth;this.viewportPortrait=globalThis.innerWidth<=globalThis.innerHeight;}
 }
 schedule(){
  if(this.pending)return;
  this.pending=requestAnimationFrame(()=>{this.pending=0;void this.sync();});
 }
 async sync(){
  const c=this.f.config;if(!c.WIDTH||!c.HEIGHT||!this.stage||!this.canvas)return;
  const stageW=this.stage.clientWidth,stageH=this.stage.clientHeight;
  if(!stageW||!stageH)return;
  const winW=globalThis.innerWidth||0,winH=globalThis.innerHeight||0,portrait=winW<=winH;
  const rotated=this.orientationPending||(this.viewportWidth>0&&winW>0&&winW!==this.viewportWidth&&this.viewportPortrait!==portrait);
  this.orientationPending=false;
  if(rotated&&this.fitted){await this.fit();return;}
  this.captureViewportMetrics();
  const key=`${stageW}:${stageH}`,dpr=Math.max(1,Math.min(3,globalThis.devicePixelRatio||1));
  const curW=this.canvas.studioViewportWidth??this.canvas.width,curH=this.canvas.studioViewportHeight??this.canvas.height;
  const curDpr=this.canvas.studioPixelRatio||1;
  const targetW=Math.min(Math.ceil(c.WIDTH*c.ZOOM),stageW),targetH=Math.min(Math.ceil(c.HEIGHT*c.ZOOM),stageH);
  const needsCanvasUpdate=curW!==targetW||curH!==targetH||curDpr!==dpr;
  if(!needsCanvasUpdate&&key===this.lastSize&&!rotated)return;
  const snap=this.captureWorldCenter();
  if(needsCanvasUpdate){
   this.syncing=true;try{this.f.app.GUI.prepare_canvas();}finally{this.syncing=false;}
   this.restoreWorldCenter(snap);
  }else{
   this.f.app.GUI.check_canvas_offset?.();
  }
  this.captureCanvasState();
  if(needsCanvasUpdate)this.f.emit('viewport');
 }
 async fit(){
  if(this.pending){cancelAnimationFrame(this.pending);this.pending=0;}
  const c=this.f.config,z=containScale(c.WIDTH,c.HEIGHT,this.stage.clientWidth,this.stage.clientHeight,10);if(!z)return;
  this.orientationPending=false;this.fitted=true;c.ZOOM=z;
  this.syncing=true;try{this.f.app.GUI.prepare_canvas();}finally{this.syncing=false;}
  view.setBounds(0,0,c.WIDTH,c.HEIGHT);view.setContext(this.f.app.Layers.ctx);
  view.scale=z;view.x=0;view.y=0;view.update();
  this.f.app.Layers.last_zoom=z;this.f.app.Layers.stable_dimensions=[c.WIDTH,c.HEIGHT];c.need_render=true;this.f.app.GUI.check_canvas_offset();
  this.captureCanvasState();this.captureViewportMetrics();this.f.emit('viewport');
 }
 async zoom(factor){
  if(!Number.isFinite(factor)||factor<=0)return;
  if(this.pending){cancelAnimationFrame(this.pending);this.pending=0;}
  const c=this.f.config,z=Math.max(.0001,Math.min(8,c.ZOOM*factor)),before=this.canvas.getBoundingClientRect();
  const anchor=this.anchor||{x:before.left+before.width/2,y:before.top+before.height/2};
  view.scaleAt(anchor.x-before.left,anchor.y-before.top,z/view.getScale());c.ZOOM=z;
  this.syncing=true;try{this.f.app.GUI.prepare_canvas();}finally{this.syncing=false;}
  const after=this.canvas.getBoundingClientRect();view.move(before.left-after.left,before.top-after.top);view.update();
  this.fitted=false;this.f.app.Layers.last_zoom=z;c.need_render=true;this.captureCanvasState();this.captureViewportMetrics();this.f.emit('viewport');
 }
}
